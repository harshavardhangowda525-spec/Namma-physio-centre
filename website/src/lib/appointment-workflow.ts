import "server-only";
import { calendarBusy, deleteEvent, upsertEvent } from "./calendar";
import {
  confirmedOn,
  getRequest,
  issueActionToken,
  recordAppointmentAudit,
  updateRequest,
  type AppointmentRequest,
} from "./db";
import {
  sendPatientConfirmationEmail,
  sendPatientDeclineEmail,
  sendPatientRescheduleProposalEmail,
} from "./notify";

const toMinutes = (t: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Infers a sensible default HH:MM time when opening the doctor approval form from a preferred slot band. */
export function inferDefaultTimeSlot(preferredTime: string): string {
  if (/^\d{2}:\d{2}$/.test(preferredTime)) return preferredTime;
  const lower = preferredTime.toLowerCase();
  if (lower.includes("early morning")) return "09:30";
  if (lower.includes("late morning")) return "10:30";
  if (lower.includes("early afternoon")) return "12:30";
  if (lower.includes("late afternoon")) return "15:30";
  if (lower.includes("evening")) return "17:30";
  return "10:00";
}

export async function checkSlotConflicts(opts: {
  excludeAppointmentId: number;
  date: string;
  time: string;
  durationMinutes: number;
}): Promise<{ conflict: string | null }> {
  const start = toMinutes(opts.time);
  if (start === null) return { conflict: "Please select a valid appointment time (HH:MM)." };

  const others = await confirmedOn(opts.date);
  const clash = others.find((o) => {
    if (o.id === opts.excludeAppointmentId || o.status !== "confirmed" || !o.confirmed_time) return false;
    const otherStart = toMinutes(o.confirmed_time);
    if (otherStart === null) return false;
    const otherDur = o.duration_minutes || 45;
    return start < otherStart + otherDur && otherStart < start + opts.durationMinutes;
  });

  if (clash) {
    return {
      conflict: `Conflicts with confirmed appointment ${clash.reference} (${clash.patient_name}) at ${clash.confirmed_time}. Please choose another time.`,
    };
  }

  const busy = await calendarBusy(opts.date, opts.time, opts.durationMinutes).catch((e) => {
    console.warn("[workflow] Google Calendar check error:", e);
    return null;
  });
  if (busy) {
    return { conflict: "Your connected Google Calendar shows another busy event during this time window." };
  }

  return { conflict: null };
}

export async function approveAppointmentWorkflow(opts: {
  appointmentId: number;
  date: string;
  time: string;
  durationMinutes?: number;
  message?: string | null;
  actor: string;
}): Promise<{ ok: true; updated: AppointmentRequest; emailSent: boolean; emailNote?: string; alreadyConfirmed?: boolean } | { ok: false; error: string }> {
  const req = await getRequest(opts.appointmentId);
  if (!req) return { ok: false, error: "Appointment request not found." };

  const dur = Math.min(180, Math.max(15, Math.round(opts.durationMinutes || req.duration_minutes || 45)));

  // Prevent duplicate confirmation processing if already confirmed for the identical schedule
  if (req.status === "confirmed" && req.confirmed_date === opts.date && req.confirmed_time === opts.time) {
    return { ok: true, updated: req, emailSent: true, alreadyConfirmed: true };
  }

  const { conflict } = await checkSlotConflicts({
    excludeAppointmentId: req.id,
    date: opts.date,
    time: opts.time,
    durationMinutes: dur,
  });
  if (conflict) return { ok: false, error: conflict };

  const eventId = await upsertEvent(req, opts.date, opts.time, dur).catch((e) => {
    console.warn("[workflow] Calendar upsert failed:", e);
    return req.calendar_event_id;
  });

  const now = new Date().toISOString();
  const updated = await updateRequest(req.id, {
    status: "confirmed",
    confirmed_date: opts.date,
    confirmed_time: opts.time,
    proposed_date: null,
    proposed_time: null,
    duration_minutes: dur,
    approved_at: now,
    approved_by: opts.actor,
    clinic_message: opts.message ?? req.clinic_message,
    calendar_event_id: eventId ?? null,
  });
  if (!updated) return { ok: false, error: "Could not update appointment record." };

  await recordAppointmentAudit({
    appointmentId: req.id,
    reference: req.reference,
    actor: opts.actor,
    action: "approved",
    previousStatus: req.status,
    newStatus: "confirmed",
    details: { confirmedDate: opts.date, confirmedTime: opts.time, durationMinutes: dur },
  });

  const mail = await sendPatientConfirmationEmail(updated);
  return { ok: true, updated, emailSent: mail.sent, emailNote: mail.reason };
}

export async function proposeRescheduleWorkflow(opts: {
  appointmentId: number;
  proposedDate: string;
  proposedTime: string;
  durationMinutes?: number;
  message?: string | null;
  actor: string;
}): Promise<{ ok: true; updated: AppointmentRequest; emailSent: boolean; emailNote?: string } | { ok: false; error: string }> {
  const req = await getRequest(opts.appointmentId);
  if (!req) return { ok: false, error: "Appointment request not found." };

  const dur = Math.min(180, Math.max(15, Math.round(opts.durationMinutes || req.duration_minutes || 45)));

  const { conflict } = await checkSlotConflicts({
    excludeAppointmentId: req.id,
    date: opts.proposedDate,
    time: opts.proposedTime,
    durationMinutes: dur,
  });
  if (conflict) return { ok: false, error: conflict };

  // Remove any previously confirmed calendar block until patient accepts the new proposed time
  if (req.calendar_event_id) {
    await deleteEvent(req.calendar_event_id).catch((e) => console.warn("[workflow] calendar delete:", e));
  }

  const updated = await updateRequest(req.id, {
    status: "reschedule_proposed",
    proposed_date: opts.proposedDate,
    proposed_time: opts.proposedTime,
    duration_minutes: dur,
    clinic_message: opts.message ?? null,
    calendar_event_id: null,
  });
  if (!updated) return { ok: false, error: "Could not save proposed schedule." };

  await recordAppointmentAudit({
    appointmentId: req.id,
    reference: req.reference,
    actor: opts.actor,
    action: "reschedule_proposed",
    previousStatus: req.status,
    newStatus: "reschedule_proposed",
    details: { proposedDate: opts.proposedDate, proposedTime: opts.proposedTime, durationMinutes: dur },
  });

  const patientToken = await issueActionToken(req.id, "patient_reschedule", 120);
  const mail = await sendPatientRescheduleProposalEmail(updated, patientToken);
  return { ok: true, updated, emailSent: mail.sent, emailNote: mail.reason };
}

export async function declineOrCancelWorkflow(opts: {
  appointmentId: number;
  kind: "decline" | "cancel";
  reason?: string | null;
  actor: string;
}): Promise<{ ok: true; updated: AppointmentRequest; emailSent: boolean; emailNote?: string } | { ok: false; error: string }> {
  const req = await getRequest(opts.appointmentId);
  if (!req) return { ok: false, error: "Appointment request not found." };

  if (req.calendar_event_id) {
    await deleteEvent(req.calendar_event_id).catch((e) => console.warn("[workflow] calendar delete:", e));
  }

  const nextStatus = opts.kind === "decline" ? "declined" : "cancelled";
  const updated = await updateRequest(req.id, {
    status: nextStatus,
    decline_reason: opts.reason ?? null,
    clinic_message: opts.reason ?? req.clinic_message,
    calendar_event_id: null,
  });
  if (!updated) return { ok: false, error: "Could not update appointment status." };

  await recordAppointmentAudit({
    appointmentId: req.id,
    reference: req.reference,
    actor: opts.actor,
    action: nextStatus,
    previousStatus: req.status,
    newStatus: nextStatus,
    details: opts.reason ? { reason: opts.reason } : undefined,
  });

  const mail = await sendPatientDeclineEmail(updated);
  return { ok: true, updated, emailSent: mail.sent, emailNote: mail.reason };
}

export async function markCompletedWorkflow(opts: {
  appointmentId: number;
  actor: string;
}): Promise<{ ok: true; updated: AppointmentRequest } | { ok: false; error: string }> {
  const req = await getRequest(opts.appointmentId);
  if (!req) return { ok: false, error: "Appointment request not found." };

  const updated = await updateRequest(req.id, { status: "completed" });
  if (!updated) return { ok: false, error: "Could not mark completed." };

  await recordAppointmentAudit({
    appointmentId: req.id,
    reference: req.reference,
    actor: opts.actor,
    action: "completed",
    previousStatus: req.status,
    newStatus: "completed",
  });
  return { ok: true, updated };
}
