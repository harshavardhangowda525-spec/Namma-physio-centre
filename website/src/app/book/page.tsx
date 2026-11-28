import type { Metadata } from "next";
import { Suspense } from "react";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { BookingFlow } from "@/components/booking";
import { clinic } from "@/content/clinic";

export const metadata: Metadata = {
  title: "Book Appointment",
  description: `Submit a clinic consultation or home physiotherapy appointment request at ${clinic.name}, JP Nagar 8th Phase, Bengaluru.`,
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  return (
    <>
      <PageHeader
        eyebrow="Book Appointment"
        title="Request your appointment"
        lead="Select a clinic consultation or home physiotherapy visit and choose your preferred schedule. Our physiotherapist will review your request and send a confirmation email once approved."
      >
        <a
          href={`tel:${clinic.phoneE164}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline"
        >
          <Phone className="h-4 w-4" aria-hidden /> Prefer to call directly? {clinic.phoneDisplay}
        </a>
      </PageHeader>
      <section className="container-px max-w-5xl">
        <Suspense>
          <BookingFlow />
        </Suspense>
      </section>
    </>
  );
}
