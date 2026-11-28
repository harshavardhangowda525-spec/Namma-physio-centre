"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { approveAppointmentWorkflow } from "@/lib/appointment-workflow";
import {
  issueActionToken,
  markActionTokenUsed,
  recordAppointmentAudit,
  updateRequest,
  verifyActionToken,
} from "@/lib/db";
import { notifyClinicNewRequest } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type PatientRespondState = {
  ok?: string;
  error?: string;
} | undefined;

const respondSchema = z.discriminatedUnion("choice", [
  z.object({
    choice: z.literal("accept"),
    token: z.string().min(20),
  }),
  z.object({
    choice: z.literal("counter"),
    token: z.string().min(20),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a preferred date"),
    preferredTime: z.string().min(2, "Choose a preferred time").max(80),
  }),
]);

export async function submitPatientRescheduleResponse(
  _: PatientRespondState,
  form: FormData,
): Promise<PatientRespondState> {
  const hdrs = await headers();
  if (!rateLimit(`pat-respond:${clientIp(hdrs)}`, 10, 10 * 60_000)) {
    return { error: "Too many requests. Please wait a few minutes or call the clinic." };
  }

  const parsed = respondSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid response." };
  }
  const d = parsed.data;

  const verified = await verifyActionToken(d.token, "patient_reschedule");
  if (!verified.valid) {
    return { error: "This schedule link has expired or is no longer active. Please call the clinic." };
  }

  const r = verified.appointment;

  if (d.choice === "accept") {
    if (!r.proposed_date || !r.proposed_time) {
      return { error: "This proposed schedule is no longer pending." };
    }
    const res = await approveAppointmentWorkflow({
      appointmentId: r.id,
      date: r.proposed_date,
      time: r.proposed_time,
      durationMinutes: r.duration_minutes,
      actor: "patient_accepted_proposal",
    });
    if (!res.ok) return { error: res.error };
    await markActionTokenUsed(verified.tokenHash);
    revalidatePath(`/appointments/respond/${d.token}`);
    revalidatePath("/admin");
    return {
      ok: `Thank you! Your appointment (${r.reference}) is now confirmed for ${r.proposed_date} at ${r.proposed_time}.`,
    };
  }

  // Patient requests another date/time -> return to Pending Doctor Approval and alert doctor
  const updated = await updateRequest(r.id, {
    status: "pending_approval",
    proposed_date: null,
    proposed_time: null,
    clinic_message: `Patient requested alternative schedule: ${d.preferredDate} (${d.preferredTime})`,
  });
  if (!updated) return { error: "Could not save your alternative preference." };

  await markActionTokenUsed(verified.tokenHash);
  await recordAppointmentAudit({
    appointmentId: r.id,
    reference: r.reference,
    actor: "patient",
    action: "requested_alternative_time",
    previousStatus: r.status,
    newStatus: "pending_approval",
    details: { preferredDate: d.preferredDate, preferredTime: d.preferredTime },
  });

  const docToken = await issueActionToken(r.id, "doctor_manage", 168);
  await notifyClinicNewRequest(
    { ...updated, preferred_date: d.preferredDate, preferred_time: d.preferredTime },
    docToken,
  ).catch((e) => console.warn("[respond] doctor re-notify:", e));

  revalidatePath(`/appointments/respond/${d.token}`);
  revalidatePath("/admin");
  return {
    ok: "Thank you. Your new preferred time has been sent to our physiotherapist for review.",
  };
}
