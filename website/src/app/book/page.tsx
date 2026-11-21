import type { Metadata } from "next";
import { Suspense } from "react";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { BookingFlow } from "@/components/booking";
import { clinic } from "@/content/clinic";

export const metadata: Metadata = {
  title: "Book Appointment",
  description: "Request a clinic visit or home physiotherapy visit with Namma Physio Centre, JP Nagar, Bengaluru.",
  alternates: { canonical: "/book" },
};

export default function BookPage() {
  return (
    <>
      <PageHeader eyebrow="Book Appointment" title="Request your appointment" lead="Choose a clinic visit or a home visit, then tell us when suits you. We'll call to confirm.">
        <a href={`tel:${clinic.phoneE164}`} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline">
          <Phone className="h-4 w-4" aria-hidden /> Prefer to call? {clinic.phoneDisplay}
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
