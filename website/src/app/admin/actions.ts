"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminConfigured, createSession, destroySession, isAdmin, verifyPassword } from "@/lib/admin-auth";
import { calendarBusy, deleteEvent, disconnectCalendar, upsertEvent } from "@/lib/calendar";
import { confirmedOn, getRequest, updateRequest } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const APPOINTMENT_MINUTES = 45;

export type ActionState = { error?: string; ok?: string } | undefined;

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  if (!adminConfigured()) return { error: "Admin access is not configured on the server." };
  if (!rateLimit(`login:${clientIp(await headers())}`, 8, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };
  const pw = String(form.get("password") ?? "");
  if (!verifyPassword(pw)) return { error: "Incorrect password." };
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.enum(["confirm", "reschedule"]),
    id: z.coerce.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
    message: z.string().max(500).optional(),
  }),
  z.object({
    decision: z.enum(["reject", "cancel"]),
    id: z.coerce.number().int().positive(),
    message: z.string().max(500).optional(),
  }),
]);

export async function decide(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isAdmin())) redirect("/admin/login");
  const parsed = decisionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const req = await getRequest(d.id);
  if (!req) return { error: "Request not found." };

  try {
    if (d.decision === "confirm" || d.decision === "reschedule") {
      // Prevent overlapping confirmed bookings (local records).
      const start = toMinutes(d.time);
      const clash = (await confirmedOn(d.date)).find(
        (o) => o.id !== req.id && o.confirmed_time && Math.abs(toMinutes(o.confirmed_time) - start) < APPOINTMENT_MINUTES,
      );
      if (clash) return { error: `Overlaps with ${clash.reference} at ${clash.confirmed_time}. Choose another time.` };

      // Check Google Calendar when connected.
      const busy = await calendarBusy(d.date, d.time, APPOINTMENT_MINUTES).catch((e) => {
        console.error(e);
        return null;
      });
      if (busy) return { error: "Your Google Calendar shows you are busy at that time." };

      const eventId = await upsertEvent(req, d.date, d.time, APPOINTMENT_MINUTES).catch((e) => {
        console.error(e);
        return req.calendar_event_id;
      });
      await updateRequest(req.id, {
        status: d.decision === "confirm" ? "confirmed" : "rescheduled",
        confirmed_date: d.date,
        confirmed_time: d.time,
        clinic_message: d.message || null,
        calendar_event_id: eventId ?? null,
      });
    } else {
      if (req.calendar_event_id) await deleteEvent(req.calendar_event_id).catch(console.error);
      await updateRequest(req.id, {
        status: d.decision === "reject" ? "rejected" : "cancelled",
        clinic_message: d.message || null,
        calendar_event_id: null,
      });
    }
  } catch (e) {
    console.error(e);
    return { error: "Could not save the change. Please try again." };
  }
  revalidatePath("/admin");
  const newStatus = { confirm: "confirmed", reschedule: "rescheduled", reject: "rejected", cancel: "cancelled" }[d.decision];
  redirect(`/admin?status=${newStatus}&saved=${encodeURIComponent(req.reference)}`);
}

export async function disconnectCalendarAction() {
  if (!(await isAdmin())) redirect("/admin/login");
  await disconnectCalendar();
  revalidatePath("/admin");
}
