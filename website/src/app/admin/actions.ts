"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminConfigured, createSession, destroySession, isAdmin, verifyPassword } from "@/lib/admin-auth";
import {
  approveAppointmentWorkflow,
  declineOrCancelWorkflow,
  markCompletedWorkflow,
  proposeRescheduleWorkflow,
} from "@/lib/appointment-workflow";
import { disconnectCalendar } from "@/lib/calendar";
import { disconnectGmail, sendGmailTestEmail } from "@/lib/gmail";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { disconnectGbpReviews, syncGoogleReviewsNow } from "@/lib/reviews";

export type ActionState = { error?: string; ok?: string } | undefined;

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  if (!adminConfigured()) return { error: "Admin access is not configured on the server." };
  if (!rateLimit(`login:${clientIp(await headers())}`, 8, 15 * 60_000)) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }
  const pw = String(form.get("password") ?? "");
  if (!verifyPassword(pw)) return { error: "Incorrect password." };
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.enum(["confirm", "reschedule"]),
    id: z.coerce.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
    durationMinutes: z.coerce.number().int().min(15).max(180).default(45),
    message: z.string().max(500).optional(),
  }),
  z.object({
    decision: z.enum(["reject", "cancel", "complete"]),
    id: z.coerce.number().int().positive(),
    message: z.string().max(500).optional(),
  }),
]);

export async function decide(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isAdmin())) redirect("/admin/login");
  const parsed = decisionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  let nextTab = "pending_approval";
  let savedRef = "";

  if (d.decision === "confirm") {
    const res = await approveAppointmentWorkflow({
      appointmentId: d.id,
      date: d.date,
      time: d.time,
      durationMinutes: d.durationMinutes,
      message: d.message || null,
      actor: "admin_dashboard",
    });
    if (!res.ok) return { error: res.error };
    nextTab = "confirmed";
    savedRef = res.updated.reference;
  } else if (d.decision === "reschedule") {
    const res = await proposeRescheduleWorkflow({
      appointmentId: d.id,
      proposedDate: d.date,
      proposedTime: d.time,
      durationMinutes: d.durationMinutes,
      message: d.message || null,
      actor: "admin_dashboard",
    });
    if (!res.ok) return { error: res.error };
    nextTab = "reschedule_proposed";
    savedRef = res.updated.reference;
  } else if (d.decision === "complete") {
    const res = await markCompletedWorkflow({
      appointmentId: d.id,
      actor: "admin_dashboard",
    });
    if (!res.ok) return { error: res.error };
    nextTab = "completed";
    savedRef = res.updated.reference;
  } else {
    const res = await declineOrCancelWorkflow({
      appointmentId: d.id,
      kind: d.decision === "reject" ? "decline" : "cancel",
      reason: d.message || null,
      actor: "admin_dashboard",
    });
    if (!res.ok) return { error: res.error };
    nextTab = d.decision === "reject" ? "declined" : "cancelled";
    savedRef = res.updated.reference;
  }

  revalidatePath("/admin");
  redirect(`/admin?status=${nextTab}&saved=${encodeURIComponent(savedRef)}`);
}

export async function disconnectCalendarAction() {
  if (!(await isAdmin())) redirect("/admin/login");
  await disconnectCalendar();
  revalidatePath("/admin");
}

export async function disconnectGmailAction() {
  if (!(await isAdmin())) redirect("/admin/login");
  await disconnectGmail();
  revalidatePath("/admin");
  redirect("/admin?gmail=disconnected");
}

export async function testGmailSendAction() {
  if (!(await isAdmin())) redirect("/admin/login");
  const res = await sendGmailTestEmail();
  revalidatePath("/admin");
  if (!res.ok) {
    redirect(`/admin?gmail=test_failed&detail=${encodeURIComponent(res.error ?? "Failed")}`);
  }
  redirect("/admin?gmail=verified");
}

export async function triggerGoogleReviewsSyncAction() {
  if (!(await isAdmin())) redirect("/admin/login");
  const res = await syncGoogleReviewsNow();
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/reviews");
  if (!res.ok) {
    redirect(`/admin?reviews=sync_failed&detail=${encodeURIComponent(res.error ?? "Sync unavailable")}`);
  }
  redirect(`/admin?reviews=synced&count=${res.syncedCount}`);
}

export async function disconnectGbpReviewsAction() {
  if (!(await isAdmin())) redirect("/admin/login");
  await disconnectGbpReviews();
  revalidatePath("/admin");
  redirect("/admin?reviews=disconnected");
}
