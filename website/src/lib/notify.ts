import "server-only";
import type { AppointmentRequest } from "./db";
import { clinic } from "@/content/clinic";

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Notifies the clinic of a new request via Resend (https://resend.com).
 * Only the details needed to call the patient back are included; free-text
 * notes are omitted from email and remain viewable in the secure admin page.
 */
export async function notifyClinic(r: AppointmentRequest): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO_EMAIL;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!key || !to || !from) return { sent: false, reason: "Email notifications are not configured" };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const kind = r.visit_type === "home" ? "Home visit" : "Clinic visit";
  const html = `
  <div style="font-family:system-ui,sans-serif;color:#0b1f3a;max-width:560px">
    <h2 style="margin:0 0 8px">New ${kind.toLowerCase()} request</h2>
    <p style="margin:0 0 16px;color:#5b6676">Reference <strong>${esc(r.reference)}</strong>. This is a request, not a confirmed appointment.</p>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      <tr><td><b>Patient</b></td><td>${esc(r.patient_name)}</td></tr>
      <tr><td><b>Mobile</b></td><td><a href="tel:+91${esc(r.mobile)}">+91 ${esc(r.mobile)}</a></td></tr>
      <tr><td><b>Preferred</b></td><td>${esc(r.preferred_date)} · ${esc(r.preferred_time)}</td></tr>
      ${r.visit_type === "home" ? `<tr><td><b>Area</b></td><td>${esc(r.locality)} ${esc(r.pin_code)}</td></tr>` : ""}
    </table>
    <p style="margin-top:20px"><a href="${esc(site)}/admin" style="background:#0b1f3a;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Open booking requests</a></p>
    <p style="font-size:12px;color:#5b6676">Sent automatically by the ${esc(clinic.name)} website.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject: `New ${kind} request · ${r.reference}`, html }),
    });
    if (!res.ok) return { sent: false, reason: `Resend responded ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}
