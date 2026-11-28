import type { Metadata } from "next";
import Link from "next/link";
import { Phone, ShieldAlert } from "lucide-react";
import { clinic } from "@/content/clinic";
import { statusLabel, verifyActionToken } from "@/lib/db";
import { Logo, buttonClass } from "@/components/ui";
import { PatientRespondForm } from "./respond-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposed Appointment Schedule",
  robots: { index: false, follow: false },
};

export default async function PatientRespondPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = await verifyActionToken(token, "patient_reschedule");

  if (!verified.valid) {
    return (
      <div className="min-h-screen bg-ivory px-4 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-line bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" aria-hidden />
          <h1 className="mt-4 text-2xl font-medium">Schedule Link Inactive</h1>
          <p className="mt-2 text-sm text-muted">
            This reschedule proposal link has already been used or has expired. Please call us directly if you need assistance.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a href={`tel:${clinic.phoneE164}`} className={buttonClass("primary", "md")}>
              <Phone className="h-4 w-4" aria-hidden /> Call {clinic.phoneDisplay}
            </a>
            <Link href="/" className={buttonClass("secondary", "md")}>
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const r = verified.appointment;
  const propDate = r.proposed_date ?? r.confirmed_date ?? r.preferred_date;
  const propTime = r.proposed_time ?? r.confirmed_time ?? r.preferred_time;

  return (
    <div className="min-h-screen bg-ivory px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-xl space-y-6">
        <Logo />
        <section className="card p-6 sm:p-8">
          <span className="eyebrow">Appointment Schedule Update</span>
          <h1 className="mt-4 text-2xl sm:text-3xl">Review Proposed Appointment Time</h1>
          <p className="mt-2 text-sm text-muted">
            Reference <strong>{r.reference}</strong> · Current status: <strong>{statusLabel(r.status)}</strong>
          </p>

          <div className="mt-6 rounded-2xl bg-cyan-soft/70 p-5 text-sm text-navy-900">
            <p>
              <strong>Patient:</strong> {r.patient_name}
            </p>
            <p className="mt-1">
              <strong>Proposed Date:</strong> {propDate}
            </p>
            <p className="mt-1">
              <strong>Proposed Time:</strong> {propTime}
            </p>
            {r.clinic_message && (
              <p className="mt-2 border-t border-navy-900/10 pt-2 text-xs text-navy-800">
                <strong>Note from clinic:</strong> {r.clinic_message}
              </p>
            )}
          </div>

          <div className="mt-6">
            {r.status === "reschedule_proposed" || r.status === "rescheduled" ? (
              <PatientRespondForm token={token} proposedDate={propDate} proposedTime={propTime} />
            ) : (
              <p className="rounded-xl bg-cream p-4 text-sm text-navy-900">
                This appointment is currently marked <strong>{statusLabel(r.status)}</strong>. For further changes, please call{" "}
                <a href={`tel:${clinic.phoneE164}`} className="font-semibold text-teal-700 underline">
                  {clinic.phoneDisplay}
                </a>
                .
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
