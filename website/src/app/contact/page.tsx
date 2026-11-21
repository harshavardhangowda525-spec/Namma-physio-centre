import type { Metadata } from "next";
import { CalendarCheck, Clock, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ButtonLink } from "@/components/ui";
import { clinic, fullAddress } from "@/content/clinic";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${clinic.name}, ${fullAddress}. Call ${clinic.phoneDisplay}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const wa = `https://wa.me/${clinic.whatsappNumber}?text=${encodeURIComponent("Hello Namma Physio Centre, I would like to enquire about an appointment.")}`;
  return (
    <>
      <PageHeader eyebrow="Contact" title="We're here to help" lead="Call, message or visit us in JP Nagar 8th Phase, Bengaluru." />
      <section className="container-px grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <Stagger className="grid content-start gap-5">
          <StaggerItem>
            <div className="card p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-600"><MapPin className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h2 className="font-sans text-lg font-semibold">Clinic address</h2>
                  <address className="mt-1 text-muted not-italic">{fullAddress}</address>
                  <p className="mt-1 text-xs text-muted">Plus Code: {clinic.address.plusCode}</p>
                  <ButtonLink href={clinic.google.directionsUrl} variant="secondary" size="sm" className="mt-4"><Navigation className="h-4 w-4" aria-hidden /> Get directions</ButtonLink>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="card p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Phone className="h-5 w-5" aria-hidden /></span>
                <div className="flex-1">
                  <h2 className="font-sans text-lg font-semibold">Phone</h2>
                  <p className="mt-1 text-muted">{clinic.phoneDisplay}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ButtonLink href={`tel:${clinic.phoneE164}`} size="sm"><Phone className="h-4 w-4" aria-hidden /> Call now</ButtonLink>
                    <ButtonLink href={wa} variant="secondary" size="sm"><MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp</ButtonLink>
                  </div>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="card p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Clock className="h-5 w-5" aria-hidden /></span>
                <div className="flex-1">
                  <h2 className="font-sans text-lg font-semibold">Operating hours</h2>
                  {clinic.hoursConfirmed ? (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                      {clinic.hours.map((h) => (<div key={h.day} className="contents"><dt className="text-navy-900">{h.day}</dt><dd className="text-muted">{h.open ?? "Closed"}{h.note ? ` · ${h.note}` : ""}</dd></div>))}
                    </dl>
                  ) : (
                    <p className="mt-1 text-sm text-muted">Hours are being confirmed. Please call before visiting. On Saturdays the clinic has an afternoon break and reopens at 3 PM.</p>
                  )}
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <ButtonLink href="/book" size="lg" className="w-full"><CalendarCheck className="h-5 w-5" aria-hidden /> Book an Appointment</ButtonLink>
          </StaggerItem>
        </Stagger>
        <Reveal delay={0.1}>
          <div className="card h-full min-h-[420px] overflow-hidden p-2">
            <iframe
              title={`Map showing ${clinic.name}`}
              src={clinic.google.embedUrl}
              className="h-full min-h-[420px] w-full rounded-[1.25rem] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </Reveal>
      </section>
    </>
  );
}
