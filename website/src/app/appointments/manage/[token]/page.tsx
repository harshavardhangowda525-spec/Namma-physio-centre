import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, ExternalLink, Home, MapPin, Phone, ShieldAlert } from "lucide-react";
import { clinic } from "@/content/clinic";
import { inferDefaultTimeSlot } from "@/lib/appointment-workflow";
import { calendarDayBusyWindows, googleCalendarDayUrl } from "@/lib/calendar";
import { confirmedOn, listAppointmentAudits, statusLabel, verifyActionToken } from "@/lib/db";
import { Logo, buttonClass } from "@/components/ui";
import { DoctorManageForm } from "./manage-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review Appointment Request",
  robots: { index: false, follow: false },
};

function fmtIstTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DoctorManageAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const verified = await verifyActionToken(token, "doctor_manage");

  if (!verified.valid) {
    return (
      <div className="min-h-screen bg-ivory px-4 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-line bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldAlert className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-medium">
            {verified.reason === "expired" ? "Approval Link Expired" : "Invalid Approval Link"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            For patient security, email approval links expire automatically. You can review and manage all appointment requests from the website administration dashboard.
          </p>
          <div className="mt-6">
            <Link href="/admin" className={buttonClass("primary", "md")}>
              Open Website Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const r = verified.appointment;
  const targetDate = r.confirmed_date ?? r.proposed_date ?? r.preferred_date;
  const [calStatus, dayConfirmed, audits] = await Promise.all([
    calendarDayBusyWindows(targetDate),
    confirmedOn(targetDate),
    listAppointmentAudits(r.id, 10),
  ]);

  const otherBookings = dayConfirmed.filter((b) => b.id !== r.id);
  const rawIntent = sp.intent;
  const initialIntent =
    rawIntent === "reschedule" || rawIntent === "decline" || rawIntent === "calendar"
      ? rawIntent
      : "confirm";

  return (
    <div className="min-h-screen bg-ivory px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Logo />
          <Link href="/admin" className="text-xs font-semibold text-teal-700 hover:underline">
            All requests (/admin) →
          </Link>
        </div>

        {/* Appointment Summary Card */}
        <section className="card overflow-hidden p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
              {statusLabel(r.status)}
            </span>
            <code className="rounded-lg bg-cream px-2.5 py-1 text-xs font-semibold text-navy-900">
              {r.reference}
            </code>
          </div>

          <h1 className="mt-4 text-2xl sm:text-3xl">{r.patient_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {r.requested_service || r.reason || "Physiotherapy Consultation & Treatment"}
          </p>

          <dl className="mt-6 grid gap-3 rounded-2xl bg-cream/75 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Requested Date</dt>
              <dd className="mt-0.5 font-semibold text-navy-900">{r.preferred_date}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Preferred Time</dt>
              <dd className="mt-0.5 font-semibold text-navy-900">{r.preferred_time}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Consultation Type</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-navy-900">
                {r.visit_type === "home" ? (
                  <>
                    <Home className="h-3.5 w-3.5 text-teal-600" aria-hidden /> Home Visit
                  </>
                ) : (
                  "Clinic Visit (JP Nagar)"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Contact</dt>
              <dd className="mt-0.5">
                <a href={`tel:+91${r.mobile}`} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> +91 {r.mobile}
                </a>
                {r.email && <span className="block truncate text-xs text-muted">{r.email}</span>}
              </dd>
            </div>
          </dl>

          {r.visit_type === "home" && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-white p-3.5 text-sm text-ink">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
              <span>
                {r.address}, {r.locality} – {r.pin_code}
              </span>
            </p>
          )}

          {r.notes && (
            <div className="mt-4 rounded-xl border border-line bg-white p-3.5 text-sm">
              <span className="text-xs font-semibold tracking-wider text-muted uppercase">Additional Notes</span>
              <p className="mt-1 whitespace-pre-wrap text-ink">{r.notes}</p>
            </div>
          )}

          {r.confirmed_date && r.status === "confirmed" && (
            <div className="mt-4 rounded-xl bg-teal-50 p-3.5 text-sm text-teal-900 ring-1 ring-teal-200">
              <strong>Confirmed Schedule:</strong> {r.confirmed_date} at {r.confirmed_time} ({r.duration_minutes} mins)
              {r.approved_at && (
                <span className="block text-xs text-teal-700">
                  Approved on {new Date(r.approved_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                </span>
              )}
            </div>
          )}
        </section>

        {/* Calendar Availability Check Section */}
        <section className="card p-6" aria-labelledby="cal-check-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-5 w-5 text-teal-600" aria-hidden />
              <h2 id="cal-check-heading" className="font-sans text-base font-semibold text-navy-900">
                Availability on {targetDate} (Asia/Kolkata)
              </h2>
            </div>
            <a
              href={googleCalendarDayUrl(targetDate)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ivory px-3.5 py-1.5 text-xs font-semibold text-navy-900 hover:border-teal-300 hover:text-teal-700"
            >
              Open Google Calendar <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>

          <div className="mt-4 space-y-2.5 text-sm">
            {otherBookings.length > 0 ? (
              <div className="rounded-xl bg-amber-50 p-3 text-amber-900 ring-1 ring-amber-200">
                <p className="font-semibold">Other website appointments on {targetDate}:</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {otherBookings.map((b) => (
                    <li key={b.id}>
                      {b.confirmed_time ?? b.proposed_time} — {b.patient_name} ({b.reference}, {statusLabel(b.status)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted">No conflicting website appointments recorded on {targetDate}.</p>
            )}

            {calStatus.connected ? (
              calStatus.error ? (
                <p className="text-xs text-amber-800">Google Calendar live check note: {calStatus.error}</p>
              ) : calStatus.busy.length > 0 ? (
                <div className="rounded-xl bg-cyan-soft/70 p-3 text-xs text-navy-900">
                  <p className="font-semibold">Google Calendar busy periods on {targetDate}:</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {calStatus.busy.map((b, idx) => (
                      <li key={idx} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-line">
                        <Clock className="h-3 w-3 text-teal-600" aria-hidden />
                        {fmtIstTime(b.start)} – {fmtIstTime(b.end)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs font-medium text-teal-700">
                  Connected Google Calendar shows no busy events on {targetDate}.
                </p>
              )
            ) : (
              <p className="text-xs text-muted">
                Tap &ldquo;Open Google Calendar&rdquo; above to inspect your calendar, or connect Google Calendar OAuth in <code>/admin</code> for automatic free/busy checking.
              </p>
            )}
          </div>
        </section>

        {/* Doctor Decision Form */}
        <section className="card p-6 sm:p-8">
          <h2 className="font-sans text-lg font-semibold text-navy-900">Doctor Approval Controls</h2>
          <p className="mt-1 text-xs text-muted">
            Select a date and time below, then tap the explicit confirmation button to update the appointment and notify the patient from {clinic.name}&apos;s Gmail.
          </p>
          <div className="mt-5">
            <DoctorManageForm
              token={token}
              appointment={r}
              defaultTime={inferDefaultTimeSlot(r.preferred_time)}
              initialIntent={initialIntent}
            />
          </div>
        </section>

        {/* Audit History */}
        {audits.length > 0 && (
          <section className="card p-5 text-xs text-muted">
            <p className="font-semibold text-navy-900 uppercase tracking-wider">Approval History</p>
            <ul className="mt-2 space-y-1.5">
              {audits.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <strong className="text-ink">{a.action}</strong> ({a.actor}) → {a.new_status}
                  </span>
                  <span>{new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
