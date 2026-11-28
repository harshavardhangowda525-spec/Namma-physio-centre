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
  title: "Physiotherapy & Rehabilitation Services",
  description:
    "Customized, evidence-based physiotherapy in JP Nagar, Bengaluru: Spine & IVDP rehabilitation, Shoulder & post-arthroscopic rehab, Knee & meniscus injury rehab, Sports injury rehabilitation, Post-surgical TKR/THR & fracture rehab, Neurological rehabilitation, and Home physiotherapy.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our Services"
        title="Customized rehabilitation shaped around you"
        lead="Every rehabilitation program at Namma Physiotherapy Centre begins with an individualized clinical assessment, followed by a customized treatment protocol designed for your condition, functional mobility and recovery goals."
      />
      <section className="container-px">
        <Suspense>
          <ServicesGrid services={publicServices} syncUrl />
        </Suspense>
        <Reveal>
          <div className="card mt-16 flex flex-col items-center justify-between gap-6 p-8 text-center md:flex-row md:text-left">
            <div>
              <h2 className="text-2xl">Not sure which physiotherapy service fits your needs?</h2>
              <p className="mt-2 text-muted">
                Request an assessment consultation — our physiotherapist will evaluate your condition and design an appropriate treatment plan.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/book">
                <CalendarCheck className="h-4 w-4" aria-hidden /> Book an Appointment
              </ButtonLink>
              <ButtonLink href={`tel:${clinic.phoneE164}`} variant="secondary">
                <Phone className="h-4 w-4" aria-hidden /> Call {clinic.phoneDisplay}
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
