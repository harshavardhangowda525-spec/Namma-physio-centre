import "server-only";
import { clinic, doctor, fullAddress, siteUrl, whatsappChatUrl } from "@/content/clinic";
import { maskEmail } from "./crypto";
import {
  findEmailDelivery,
  recordEmailDelivery,
  type AppointmentRequest,
} from "./db";
import { sendViaGmailApi, targetClinicGmail } from "./gmail";

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function baseSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || siteUrl).replace(/\/+$/, "");
}

function consultationLabel(visitType: "clinic" | "home"): string {
  return visitType === "home" ? "Home Physiotherapy Visit" : "Clinic Consultation";
}

function selectedServiceLabel(r: AppointmentRequest): string {
  return r.requested_service || r.reason || "Physiotherapy Consultation & Treatment";
}

async function deliverTrackedEmail(opts: {
  dedupeKey: string;
  appointmentId?: number | null;
  reference?: string | null;
  template: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  allowResendClinicFallback?: boolean;
}): Promise<{ sent: boolean; reason?: string; duplicateSkipped?: boolean }> {
  const existing = await findEmailDelivery(opts.dedupeKey);
  if (existing && (existing.status === "submitted_to_gmail" || existing.status === "sent_fallback")) {
    return { sent: true, duplicateSkipped: true };
  }

  const recipientMasked = maskEmail(opts.to);
  const gmailResult = await sendViaGmailApi({
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    replyTo: opts.replyTo,
  });

  if (gmailResult.sent) {
    await recordEmailDelivery({
      dedupeKey: opts.dedupeKey,
      appointmentId: opts.appointmentId,
      reference: opts.reference,
      template: opts.template,
      recipientMasked,
      provider: "gmail_oauth",
      status: "submitted_to_gmail",
      gmailMessageId: gmailResult.messageId ?? null,
      attempts: gmailResult.attempts,
      lastError: null,
    });
    return { sent: true };
  }

  // Optional Resend fallback ONLY for internal clinic new-request alerts (never spoofs patient confirmation sender)
  if (opts.allowResendClinicFallback) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_FROM_EMAIL;
    const fallbackTo = process.env.NOTIFY_TO_EMAIL || opts.to;
    if (key && from && fallbackTo) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: fallbackTo.split(",").map((s) => s.trim()),
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
          }),
        });
        if (res.ok) {
          await recordEmailDelivery({
            dedupeKey: opts.dedupeKey,
            appointmentId: opts.appointmentId,
            reference: opts.reference,
            template: opts.template,
            recipientMasked,
            provider: "resend_fallback",
            status: "sent_fallback",
            attempts: gmailResult.attempts + 1,
            lastError: gmailResult.error ?? null,
          });
          return { sent: true };
        }
      } catch {
        // Proceed to log failure below
      }
    }
  }

  const isUnconfigured = (gmailResult.error ?? "").includes("not connected");
  await recordEmailDelivery({
    dedupeKey: opts.dedupeKey,
    appointmentId: opts.appointmentId,
    reference: opts.reference,
    template: opts.template,
    recipientMasked,
    provider: isUnconfigured ? "none" : "gmail_oauth",
    status: isUnconfigured ? "skipped" : "failed",
    attempts: gmailResult.attempts,
    lastError: gmailResult.error ?? "Email delivery unavailable",
  });

  return { sent: false, reason: gmailResult.error ?? "Email delivery unavailable" };
}

/**
 * 1. Sends new appointment request notification to Smilewithsidhu2008@gmail.com
 *    with secure touchscreen-friendly doctor review & approval links.
 *    NOTE: Opening any link only opens a GET review screen and NEVER auto-approves.
 */
export async function notifyClinicNewRequest(
  r: AppointmentRequest,
  doctorManageToken: string,
): Promise<{ sent: boolean; reason?: string }> {
  const site = baseSiteUrl();
  const baseManageUrl = `${site}/appointments/manage/${encodeURIComponent(doctorManageToken)}`;
  const checkCalUrl = `${baseManageUrl}?intent=calendar`;
  const confirmUrl = `${baseManageUrl}?intent=confirm`;
  const rescheduleUrl = `${baseManageUrl}?intent=reschedule`;
  const declineUrl = `${baseManageUrl}?intent=decline`;

  const serviceName = selectedServiceLabel(r);
  const consultType = r.visit_type === "home" ? "Home" : "Clinic";
  const subject = `New Appointment Request — ${r.patient_name} | ${r.preferred_date}`;

  const text = [
    "Hello,",
    "",
    `A new appointment request has been received through the ${clinic.name} website.`,
    "",
    "Appointment Details",
    `Patient Name: ${r.patient_name}`,
    `Contact Number: +91 ${r.mobile}`,
    `Email Address: ${r.email || "Not provided"}`,
    `Requested Service: ${serviceName}`,
    `Preferred Date: ${r.preferred_date}`,
    `Preferred Time: ${r.preferred_time}`,
    `Consultation Type: ${consultType}${r.visit_type === "home" && r.locality ? ` (${r.locality} - ${r.pin_code ?? ""})` : ""}`,
    `Appointment Reference: ${r.reference}`,
    "",
    "Please review your availability before confirming this appointment:",
    `- Check Calendar: ${checkCalUrl}`,
    `- Confirm Appointment: ${confirmUrl}`,
    `- Reschedule Appointment: ${rescheduleUrl}`,
    `- Decline Appointment: ${declineUrl}`,
    "",
    `${clinic.name} — Website Appointment Management`,
  ].join("\n");

  const btnBase =
    "display:inline-block;padding:13px 20px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;text-align:center;margin:4px 6px 4px 0;";

  const html = `
  <div style="background:#f5f2ec;padding:20px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1f3a">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e1d8;border-radius:20px;overflow:hidden">
      <div style="background:#0b1f3a;padding:22px 24px;color:#ffffff">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#77d0c6">${esc(clinic.name)}</p>
        <h1 style="margin:6px 0 0;font-size:21px;line-height:1.3;color:#ffffff">New Appointment Request</h1>
      </div>

      <div style="padding:24px">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1c2534">
          Hello,<br/>
          A new appointment request has been received through the <strong>${esc(clinic.name)}</strong> website.
        </p>

        <div style="background:#fbfaf7;border:1px solid #e5e1d8;border-radius:14px;padding:16px 18px;margin-bottom:20px">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0e7a73">Appointment Details</p>
          <table cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#0b1f3a">
            <tr><td style="color:#5b6676;width:40%">Patient Name</td><td style="font-weight:600">${esc(r.patient_name)}</td></tr>
            <tr><td style="color:#5b6676">Contact Number</td><td><a href="tel:+91${esc(r.mobile)}" style="color:#0e7a73;font-weight:600;text-decoration:none">+91 ${esc(r.mobile)}</a></td></tr>
            <tr><td style="color:#5b6676">Email Address</td><td>${r.email ? `<a href="mailto:${esc(r.email)}" style="color:#0b1f3a">${esc(r.email)}</a>` : '<span style="color:#5b6676">Not provided</span>'}</td></tr>
            <tr><td style="color:#5b6676">Requested Service</td><td style="font-weight:600">${esc(serviceName)}</td></tr>
            <tr><td style="color:#5b6676">Preferred Date</td><td style="font-weight:700;color:#0b1f3a">${esc(r.preferred_date)}</td></tr>
            <tr><td style="color:#5b6676">Preferred Time</td><td style="font-weight:600">${esc(r.preferred_time)}</td></tr>
            <tr><td style="color:#5b6676">Consultation Type</td><td style="font-weight:600">${esc(consultType)}${r.visit_type === "home" && r.locality ? ` · ${esc(r.locality)} (${esc(r.pin_code)})` : ""}</td></tr>
            <tr><td style="color:#5b6676">Appointment Reference</td><td><code style="background:#eefaf8;padding:2px 8px;border-radius:6px;font-weight:700;color:#0f615c">${esc(r.reference)}</code></td></tr>
          </table>
        </div>

        <p style="margin:0 0 14px;font-size:14px;font-weight:600;color:#0b1f3a">
          Please review your availability before confirming this appointment:
        </p>

        <div style="margin-bottom:20px">
          <a href="${esc(checkCalUrl)}" style="${btnBase}background:#eefaf8;color:#0f615c;border:1px solid #ace5dd">Check Calendar</a>
          <a href="${esc(confirmUrl)}" style="${btnBase}background:#16978d;color:#ffffff">Confirm Appointment</a>
          <a href="${esc(rescheduleUrl)}" style="${btnBase}background:#0b1f3a;color:#ffffff">Reschedule Appointment</a>
          <a href="${esc(declineUrl)}" style="${btnBase}background:#ffffff;color:#b91c1c;border:1px solid #fecaca">Decline Appointment</a>
        </div>

        <p style="margin:0;font-size:12px;line-height:1.5;color:#5b6676">
          Security note: Opening any button opens a secure review screen — appointments are never approved automatically without your explicit confirmation.<br/>
          <strong>${esc(clinic.name)} — Website Appointment Management</strong>
        </p>
      </div>
    </div>
  </div>`;

  return deliverTrackedEmail({
    dedupeKey: `clinic_new_request:${r.reference}`,
    appointmentId: r.id,
    reference: r.reference,
    template: "clinic_new_request",
    to: targetClinicGmail(),
    replyTo: r.email ?? undefined,
    subject,
    text,
    html,
    allowResendClinicFallback: true,
  });
}

/** Backwards-compatible alias if imported elsewhere. */
export async function notifyClinic(r: AppointmentRequest, token = ""): Promise<{ sent: boolean; reason?: string }> {
  return notifyClinicNewRequest(r, token);
}

/**
 * 2. Optional immediate patient acknowledgement email (distinct from confirmation).
 */
export async function sendPatientAcknowledgementEmail(
  r: AppointmentRequest,
): Promise<{ sent: boolean; reason?: string }> {
  if (!r.email) return { sent: false, reason: "No patient email provided" };
  if (process.env.SEND_PATIENT_ACKNOWLEDGEMENT === "false") {
    return { sent: false, reason: "Patient acknowledgement email disabled" };
  }

  const subject = "We Have Received Your Appointment Request";
  const serviceName = selectedServiceLabel(r);
  const consultType = consultationLabel(r.visit_type);

  const text = [
    `Dear ${r.patient_name},`,
    "",
    `Thank you for contacting ${clinic.name}.`,
    "",
    "We have received your appointment request. Our physiotherapist will review your preferred schedule and notify you once your appointment has been approved.",
    "",
    "Please note that your appointment is currently pending confirmation.",
    "",
    `Reference Number: ${r.reference}`,
    `Requested Service: ${serviceName}`,
    `Preferred Schedule: ${r.preferred_date} · ${r.preferred_time} (${consultType})`,
    "",
    "Warm regards,",
    clinic.name,
    clinic.phoneDisplay,
  ].join("\n");

  const html = `
  <div style="background:#f5f2ec;padding:20px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1f3a">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e1d8;border-radius:20px;overflow:hidden">
      <div style="background:#0b1f3a;padding:20px 24px;color:#ffffff">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#77d0c6">${esc(clinic.name)}</p>
        <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff">Appointment Request Received</h1>
      </div>
      <div style="padding:24px;font-size:15px;line-height:1.6;color:#1c2534">
        <p style="margin:0 0 14px">Dear ${esc(r.patient_name)},</p>
        <p style="margin:0 0 14px">Thank you for contacting <strong>${esc(clinic.name)}</strong>.</p>
        <p style="margin:0 0 14px">
          We have received your appointment request. Our physiotherapist will review your preferred schedule and notify you once your appointment has been approved.
        </p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;margin:16px 0;font-size:14px;color:#92400e">
          <strong>Status: Pending Doctor Approval</strong> — Please note that your appointment is currently pending confirmation.
        </div>
        <div style="background:#fbfaf7;border:1px solid #e5e1d8;border-radius:12px;padding:14px 16px;font-size:14px">
          <p style="margin:0 0 6px"><strong>Reference:</strong> ${esc(r.reference)}</p>
          <p style="margin:0 0 6px"><strong>Requested Service:</strong> ${esc(serviceName)}</p>
          <p style="margin:0"><strong>Preferred Schedule:</strong> ${esc(r.preferred_date)} · ${esc(r.preferred_time)} (${esc(consultType)})</p>
        </div>
        <p style="margin:20px 0 0">Warm regards,<br/><strong>${esc(clinic.name)}</strong><br/><span style="font-size:13px;color:#5b6676">${esc(clinic.phoneDisplay)}</span></p>
      </div>
    </div>
  </div>`;

  return deliverTrackedEmail({
    dedupeKey: `patient_ack:${r.reference}`,
    appointmentId: r.id,
    reference: r.reference,
    template: "patient_acknowledgement",
    to: r.email,
    subject,
    text,
    html,
  });
}

/**
 * 3. Automatic Patient Confirmation Email — sent ONLY after explicit doctor approval.
 */
export async function sendPatientConfirmationEmail(
  r: AppointmentRequest,
): Promise<{ sent: boolean; reason?: string }> {
  if (!r.email) return { sent: false, reason: "Patient did not provide an email address" };
  const confirmedDate = r.confirmed_date ?? r.preferred_date;
  const confirmedTime = r.confirmed_time ?? r.preferred_time;
  const serviceName = selectedServiceLabel(r);
  const consultType = r.visit_type === "home" ? "Home" : "Clinic";
  const subject = `Appointment Confirmed — ${clinic.name}`;

  const waUrl = whatsappChatUrl(
    `Hello ${clinic.name}, I have a question regarding my confirmed appointment (${r.reference}) on ${confirmedDate} at ${confirmedTime}.`,
  );

  const locationLines =
    r.visit_type === "clinic"
      ? [
          "",
          "Clinic Address & Directions",
          fullAddress,
          `Google Maps Directions: ${clinic.google.directionsUrl}`,
        ]
      : [
          "",
          "Home Physiotherapy Visit",
          `Scheduled at your provided address in ${[r.locality, r.pin_code].filter(Boolean).join(" ")}.`,
        ];

  const text = [
    `Dear ${r.patient_name},`,
    "",
    "Your physiotherapy appointment has been reviewed and confirmed by our physiotherapist.",
    "",
    "Confirmed Appointment Details",
    `Physiotherapist: ${doctor.name}`,
    `Service: ${serviceName}`,
    `Date: ${confirmedDate}`,
    `Time: ${confirmedTime}`,
    `Consultation Type: ${consultType}`,
    `Appointment Reference: ${r.reference}`,
    ...locationLines,
    "",
    "If you have any questions or need to reschedule your appointment, please contact us using the information below:",
    `- Call Clinic: ${clinic.phoneDisplay}`,
    `- Chat on WhatsApp: ${waUrl}`,
    ...(r.visit_type === "clinic" ? [`- Get Directions: ${clinic.google.directionsUrl}`] : []),
    "",
    `We look forward to welcoming you to ${clinic.name}.`,
    "",
    "Warm regards,",
    clinic.name,
  ].join("\n");

  const ctaStyle =
    "display:inline-block;padding:11px 18px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 6px 4px 0;";

  const html = `
  <div style="background:#f5f2ec;padding:20px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1f3a">
    <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e5e1d8;border-radius:20px;overflow:hidden">
      <div style="background:#0e7a73;padding:22px 24px;color:#ffffff">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#d5f2ee">${esc(clinic.name)}</p>
        <h1 style="margin:6px 0 0;font-size:22px;color:#ffffff">Appointment Confirmed</h1>
      </div>
      <div style="padding:24px;font-size:15px;line-height:1.6;color:#1c2534">
        <p style="margin:0 0 14px">Dear ${esc(r.patient_name)},</p>
        <p style="margin:0 0 18px">
          Your physiotherapy appointment has been reviewed and confirmed by our physiotherapist.
        </p>

        <div style="background:#eefaf8;border:1px solid #ace5dd;border-radius:14px;padding:16px 18px;margin-bottom:18px">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0f615c">Confirmed Appointment Details</p>
          <table cellpadding="5" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#0b1f3a">
            <tr><td style="color:#5b6676;width:40%">Physiotherapist</td><td style="font-weight:600">${esc(doctor.name)}</td></tr>
            <tr><td style="color:#5b6676">Service</td><td style="font-weight:600">${esc(serviceName)}</td></tr>
            <tr><td style="color:#5b6676">Date</td><td style="font-weight:700">${esc(confirmedDate)}</td></tr>
            <tr><td style="color:#5b6676">Time</td><td style="font-weight:700">${esc(confirmedTime)}</td></tr>
            <tr><td style="color:#5b6676">Consultation Type</td><td style="font-weight:600">${esc(consultType)}</td></tr>
            <tr><td style="color:#5b6676">Appointment Reference</td><td><code style="font-weight:700;color:#0f615c">${esc(r.reference)}</code></td></tr>
          </table>
        </div>

        ${
          r.visit_type === "clinic"
            ? `<div style="background:#fbfaf7;border:1px solid #e5e1d8;border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:13.5px">
                <p style="margin:0 0 4px;font-weight:700;color:#0b1f3a">Clinic Address</p>
                <p style="margin:0;color:#5b6676">${esc(fullAddress)}</p>
              </div>`
            : ""
        }

        <p style="margin:0 0 12px;font-size:14px;color:#5b6676">
          If you have any questions or need to reschedule your appointment, please contact us using the options below:
        </p>

        <div style="margin-bottom:20px">
          <a href="tel:${esc(clinic.phoneE164)}" style="${ctaStyle}background:#0b1f3a;color:#ffffff">Call Clinic</a>
          <a href="${esc(waUrl)}" style="${ctaStyle}background:#1fa855;color:#ffffff">Chat on WhatsApp</a>
          ${
            r.visit_type === "clinic"
              ? `<a href="${esc(clinic.google.directionsUrl)}" style="${ctaStyle}background:#eefaf8;color:#0f615c;border:1px solid #ace5dd">Get Directions</a>`
              : ""
          }
        </div>

        <p style="margin:0 0 14px">We look forward to welcoming you to ${esc(clinic.name)}.</p>
        <p style="margin:0">Warm regards,<br/><strong>${esc(clinic.name)}</strong></p>
      </div>
    </div>
  </div>`;

  return deliverTrackedEmail({
    dedupeKey: `patient_confirm:${r.id}:${confirmedDate}:${confirmedTime}`,
    appointmentId: r.id,
    reference: r.reference,
    template: "patient_confirmation",
    to: r.email,
    subject,
    text,
    html,
  });
}

/**
 * 4. Patient Reschedule Proposal Email — invites patient to accept proposed slot or request another time.
 */
export async function sendPatientRescheduleProposalEmail(
  r: AppointmentRequest,
  patientResponseToken: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!r.email) return { sent: false, reason: "Patient did not provide an email address" };
  const propDate = r.proposed_date ?? r.confirmed_date ?? r.preferred_date;
  const propTime = r.proposed_time ?? r.confirmed_time ?? r.preferred_time;
  const respondUrl = `${baseSiteUrl()}/appointments/respond/${encodeURIComponent(patientResponseToken)}`;
  const subject = `Proposed Appointment Schedule — ${clinic.name}`;

  const text = [
    `Dear ${r.patient_name},`,
    "",
    `Thank you for your appointment request (${r.reference}) with ${clinic.name}.`,
    `Your originally requested preference was ${r.preferred_date} (${r.preferred_time}).`,
    "",
    "Our physiotherapist would like to propose the following schedule:",
    `Proposed Date: ${propDate}`,
    `Proposed Time: ${propTime}`,
    ...(r.clinic_message ? [`Note: ${r.clinic_message}`] : []),
    "",
    `Please review and accept this proposed time (or request an alternative) using this secure link: ${respondUrl}`,
    "",
    "Note: Your appointment will be marked confirmed once accepted.",
    "",
    "Warm regards,",
    clinic.name,
    clinic.phoneDisplay,
  ].join("\n");

  const html = `
  <div style="background:#f5f2ec;padding:20px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1f3a">
    <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e5e1d8;border-radius:20px;overflow:hidden">
      <div style="background:#0b1f3a;padding:22px 24px;color:#ffffff">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#77d0c6">${esc(clinic.name)}</p>
        <h1 style="margin:6px 0 0;font-size:21px;color:#ffffff">Alternative Appointment Time Proposed</h1>
      </div>
      <div style="padding:24px;font-size:15px;line-height:1.6;color:#1c2534">
        <p style="margin:0 0 14px">Dear ${esc(r.patient_name)},</p>
        <p style="margin:0 0 16px">
          Our physiotherapist has reviewed your request (<strong>${esc(r.reference)}</strong>) for ${esc(r.preferred_date)} (${esc(r.preferred_time)}) and would like to propose the following available schedule:
        </p>
        <div style="background:#e3f6fb;border:1px solid #bae6fd;border-radius:14px;padding:16px 18px;margin-bottom:18px">
          <p style="margin:0 0 6px;font-size:14px"><strong>Proposed Date:</strong> ${esc(propDate)}</p>
          <p style="margin:0;font-size:14px"><strong>Proposed Time:</strong> ${esc(propTime)}</p>
          ${r.clinic_message ? `<p style="margin:10px 0 0;font-size:13.5px;color:#1d3c66"><strong>Note from clinic:</strong> ${esc(r.clinic_message)}</p>` : ""}
        </div>
        <p style="margin:0 0 18px">
          <a href="${esc(respondUrl)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#16978d;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Accept Proposed Time or Request Another Slot</a>
        </p>
        <p style="margin:0 0 14px;font-size:13px;color:#5b6676">
          Please note: Your appointment remains pending until you confirm acceptance of the proposed time. You may also call us at <a href="tel:${esc(clinic.phoneE164)}" style="color:#0e7a73">${esc(clinic.phoneDisplay)}</a>.
        </p>
        <p style="margin:0">Warm regards,<br/><strong>${esc(clinic.name)}</strong></p>
      </div>
    </div>
  </div>`;

  return deliverTrackedEmail({
    dedupeKey: `patient_reschedule:${r.id}:${propDate}:${propTime}`,
    appointmentId: r.id,
    reference: r.reference,
    template: "patient_reschedule_proposal",
    to: r.email,
    subject,
    text,
    html,
  });
}

/**
 * 5. Polite Patient Decline / Cancellation Notification Email (omits sensitive details).
 */
export async function sendPatientDeclineEmail(
  r: AppointmentRequest,
): Promise<{ sent: boolean; reason?: string }> {
  if (!r.email) return { sent: false, reason: "Patient did not provide an email address" };
  const subject = `Update Regarding Your Appointment Request — ${clinic.name}`;
  const note = r.decline_reason || r.clinic_message;

  const text = [
    `Dear ${r.patient_name},`,
    "",
    `Thank you for reaching out to ${clinic.name} regarding appointment reference ${r.reference} (${r.preferred_date}).`,
    "",
    "Unfortunately, we are unable to accommodate the requested schedule at this time.",
    ...(note ? [`Note from the clinic: ${note}`] : []),
    "",
    `If you would like to explore an alternative day or speak with us directly, please call ${clinic.phoneDisplay} or submit a new preferred time on our website.`,
    "",
    "Warm regards,",
    clinic.name,
  ].join("\n");

  const html = `
  <div style="background:#f5f2ec;padding:20px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1f3a">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e1d8;border-radius:20px;overflow:hidden">
      <div style="background:#0b1f3a;padding:20px 24px;color:#ffffff">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#77d0c6">${esc(clinic.name)}</p>
        <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff">Appointment Request Update</h1>
      </div>
      <div style="padding:24px;font-size:15px;line-height:1.6;color:#1c2534">
        <p style="margin:0 0 14px">Dear ${esc(r.patient_name)},</p>
        <p style="margin:0 0 14px">
          Thank you for contacting <strong>${esc(clinic.name)}</strong> regarding your appointment request (<strong>${esc(r.reference)}</strong>) for ${esc(r.preferred_date)}.
        </p>
        <p style="margin:0 0 14px">
          Unfortunately, our physiotherapist is unable to accommodate the requested schedule at this time.
        </p>
        ${note ? `<div style="background:#fbfaf7;border:1px solid #e5e1d8;border-radius:12px;padding:12px 14px;margin:14px 0;font-size:14px;color:#1c2534">${esc(note)}</div>` : ""}
        <p style="margin:0 0 16px;font-size:14px;color:#5b6676">
          If you would like assistance selecting another convenient date, please call us at <a href="tel:${esc(clinic.phoneE164)}" style="color:#0e7a73;font-weight:600">${esc(clinic.phoneDisplay)}</a> or chat with us on <a href="${esc(whatsappChatUrl())}" style="color:#0e7a73;font-weight:600">WhatsApp</a>.
        </p>
        <p style="margin:0">Warm regards,<br/><strong>${esc(clinic.name)}</strong></p>
      </div>
    </div>
  </div>`;

  return deliverTrackedEmail({
    dedupeKey: `patient_decline:${r.id}:${r.status}`,
    appointmentId: r.id,
    reference: r.reference,
    template: "patient_decline",
    to: r.email,
    subject,
    text,
    html,
  });
}
