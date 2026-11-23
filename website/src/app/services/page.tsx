import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ServicesGrid } from "@/components/services";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui";
import { publicServices } from "@/content/services";
import { clinic } from "@/content/clinic";

export const metadata: Metadata = {
  title: "Our Services",
  description: "Physiotherapy for back and neck pain, shoulder pain, knee and sports injuries, joint pain, post-surgical and knee replacement rehabilitation, plus home-visit physiotherapy in JP Nagar, Bengaluru.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader eyebrow="Our Services" title="Rehabilitation shaped around you" lead="Explore the physiotherapy services available at Namma Physio Centre. Select any service to learn what it involves and what to expect." />
      <section className="container-px">
        <Suspense>
          <ServicesGrid services={publicServices} syncUrl />
        </Suspense>
        <Reveal>
          <div className="card mt-16 flex flex-col items-center justify-between gap-6 p-8 text-center md:flex-row md:text-left">
            <div>
              <h2 className="text-2xl">Not sure which service you need?</h2>
              <p className="mt-2 text-muted">Book a consultation and we&apos;ll assess your condition and recommend the right approach.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/book"><CalendarCheck className="h-4 w-4" aria-hidden /> Book an Appointment</ButtonLink>
              <ButtonLink href={`tel:${clinic.phoneE164}`} variant="secondary"><Phone className="h-4 w-4" aria-hidden /> Call the clinic</ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
