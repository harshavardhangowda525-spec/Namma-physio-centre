import { NextResponse } from "next/server";
import { bookingSchema } from "@/lib/booking-schema";
import { findRecentDuplicateRequest, insertRequest, StorageUnavailableError, toSyncedInquiry } from "@/lib/db";
import { notifyBillingWebhook } from "@/lib/inquiry-sync";
import { notifyClinic } from "@/lib/notify";
import { makeReference } from "@/lib/reference";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!rateLimit(`book:${clientIp(req.headers)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later or call the clinic." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the highlighted fields", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const d = parsed.data;
  if (d.company) return NextResponse.json({ reference: makeReference() }, { status: 201 }); // honeypot: pretend success

  try {
    const candidate = {
      reference: makeReference(),
      visit_type: d.visitType,
      patient_name: d.patientName,
      mobile: d.mobile,
      email: d.email ?? null,
      address: d.visitType === "home" ? d.address : null,
      locality: d.visitType === "home" ? d.locality : null,
      pin_code: d.visitType === "home" ? d.pinCode : null,
      preferred_date: d.preferredDate,
      preferred_time: d.preferredTime,
      reason: d.reason ?? null,
      notes: d.notes ?? null,
      consent_at: new Date().toISOString(),
    };
    const duplicate = await findRecentDuplicateRequest(candidate);
    if (duplicate) {
      return NextResponse.json({ reference: duplicate.reference, status: duplicate.status }, { status: 201 });
    }

    const saved = await insertRequest(candidate);
    const [notified] = await Promise.all([notifyClinic(saved), notifyBillingWebhook(toSyncedInquiry(saved))]);
    if (!notified.sent) console.warn(`[booking] ${saved.reference} saved; notification not sent: ${notified.reason}`);
    return NextResponse.json({ reference: saved.reference, status: saved.status }, { status: 201 });
  } catch (e) {
    console.error("[booking] failed to store request", e instanceof StorageUnavailableError ? e.message : e);
    return NextResponse.json(
      { error: "We couldn't submit your request right now. Please call the clinic directly." },
      { status: 503 },
    );
  }
}
