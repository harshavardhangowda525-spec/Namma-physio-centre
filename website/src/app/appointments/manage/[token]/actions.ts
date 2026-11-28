"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  approveAppointmentWorkflow,
  declineOrCancelWorkflow,
  markCompletedWorkflow,
  proposeRescheduleWorkflow,
} from "@/lib/appointment-workflow";
import { markActionTokenUsed, verifyActionToken } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type ManageActionState = {
  ok?: string;
  error?: string;
  emailNote?: string;
} | undefined;

const manageSchema = z.discriminatedUnion("actionType", [
  z.object({
    actionType: z.enum(["confirm", "reschedule"]),
    token: z.string().min(20),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid date"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Please choose a valid time"),
    durationMinutes: z.coerce.number().int().min(15).max(180).default(45),
    message: z.string().trim().max(400).optional(),
  }),
  z.object({
    actionType: z.enum(["decline", "cancel", "complete"]),
    token: z.string().min(20),
    message: z.string().trim().max(400).optional(),
  }),
]);

export async function submitDoctorDecision(
  _: ManageActionState,
  form: FormData,
): Promise<ManageActionState> {
  const hdrs = await headers();
  if (!rateLimit(`doc-manage:${clientIp(hdrs)}`, 20, 10 * 60_000)) {
    return { error: "Too many requests. Please wait a moment and try again." };
  }

  const parsed = manageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the entered schedule." };
  }
  const d = parsed.data;

  const verified = await verifyActionToken(d.token, "doctor_manage");
  if (!verified.valid) {
    return {
      error:
        verified.reason === "expired"
          ? "This approval link has expired for security. Please sign in at /admin to manage this appointment."
          : "Invalid or revoked approval link.",
    };
  }

  const appt = verified.appointment;

  if (d.actionType === "confirm") {
    const res = await approveAppointmentWorkflow({
      appointmentId: appt.id,
      date: d.date,
      time: d.time,
      durationMinutes: d.durationMinutes,
      message: d.message || null,
      actor: "doctor_gmail_link",
    });
    if (!res.ok) return { error: res.error };
    await markActionTokenUsed(verified.tokenHash);
    revalidatePath(`/appointments/manage/${d.token}`);
    revalidatePath("/admin");
    return {
      ok: res.alreadyConfirmed
        ? `Appointment ${appt.reference} was already confirmed for ${d.date} at ${d.time}.`
        : `Appointment ${appt.reference} confirmed for ${d.date} at ${d.time}.`,
      emailNote: res.emailSent
        ? "Patient confirmation email sent from clinic Gmail."
        : res.emailNote,
    };
  }

  if (d.actionType === "reschedule") {
    const res = await proposeRescheduleWorkflow({
      appointmentId: appt.id,
      proposedDate: d.date,
      proposedTime: d.time,
      durationMinutes: d.durationMinutes,
      message: d.message || null,
      actor: "doctor_gmail_link",
    });
    if (!res.ok) return { error: res.error };
    await markActionTokenUsed(verified.tokenHash);
    revalidatePath(`/appointments/manage/${d.token}`);
    revalidatePath("/admin");
    return {
      ok: `Proposed alternative schedule (${d.date} at ${d.time}) saved for ${appt.reference}.`,
      emailNote: res.emailSent
        ? "Reschedule proposal email sent to patient."
        : res.emailNote,
    };
  }

  if (d.actionType === "complete") {
    const res = await markCompletedWorkflow({
      appointmentId: appt.id,
      actor: "doctor_gmail_link",
    });
    if (!res.ok) return { error: res.error };
    revalidatePath(`/appointments/manage/${d.token}`);
    revalidatePath("/admin");
    return { ok: `Marked ${appt.reference} as Completed.` };
  }

  const res = await declineOrCancelWorkflow({
    appointmentId: appt.id,
    kind: d.actionType === "decline" ? "decline" : "cancel",
    reason: d.message || null,
    actor: "doctor_gmail_link",
  });
  if (!res.ok) return { error: res.error };
  await markActionTokenUsed(verified.tokenHash);
  revalidatePath(`/appointments/manage/${d.token}`);
  revalidatePath("/admin");
  return {
    ok: `Appointment ${appt.reference} marked as ${d.actionType === "decline" ? "Declined" : "Cancelled"}.`,
    emailNote: res.emailSent ? "Patient notification email sent." : res.emailNote,
  };
}
