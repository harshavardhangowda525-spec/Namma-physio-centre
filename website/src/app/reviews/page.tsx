import type { Metadata } from "next";
import { ExternalLink, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RatingSummary, ReviewsBrowser, ReviewsCarousel } from "@/components/reviews";
import { Reveal } from "@/components/motion";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { reviewHighlights } from "@/content/reviews";
import { clinic } from "@/content/clinic";
import { getReviews } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Patient Reviews",
  description: `Read authentic Google reviews from patients who received physiotherapy and rehabilitation care at ${clinic.name}, JP Nagar, Bengaluru.`,
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsPage() {
  const data = await getReviews();
  const hasReviews = data.reviews.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Patient Reviews"
        title="Patient experiences"
        lead={`Authentic patient feedback associated with ${clinic.name}'s Google Business Profile.`}
      />
      <section className="container-px space-y-12">
        <Reveal>
          <RatingSummary rating={data.rating} total={data.total} mapsUrl={data.mapsUrl} />
        </Reveal>

        <Reveal>
          <p className="flex items-start gap-2.5 rounded-2xl bg-cyan-soft/60 p-4 text-sm text-navy-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
            <span>
              {data.summarySource === "gbp-live"
                ? `Synchronized directly from our verified Google Business Profile (${data.reviews.length} published review texts synced out of ${data.total} total ratings). `
                : hasReviews
                  ? `Showing ${data.reviews.length} authentic Google reviews retrieved via Google's official API${data.importedCount ? " and authorised clinic sync" : ""} (Google Places API provides a limited selection of up to 5 reviews unless Business Profile OAuth is authorized). `
                  : "Live verbatim review synchronization activates automatically once the clinic owner completes Google Business Profile OAuth or Google Places API configuration. Until then, verified review summaries are displayed below. "}
              {data.syncMeta?.last_status === "error" && (
                <span className="font-medium text-amber-900">
                  Note: Latest scheduled sync encountered a temporary API issue; displaying the latest valid permitted content.{" "}
                </span>
              )}
              To read every review directly, visit our Google listing.
            </span>
          </p>
        </Reveal>

        <ReviewsCarousel
          reviews={data.reviews.slice(0, 12)}
          highlights={reviewHighlights}
          mapsUrl={data.mapsUrl}
        />

        {hasReviews && data.reviews.length > 3 && (
          <div className="pt-8">
            <SectionHeading align="left" title="Browse & search reviews" />
            <div className="mt-8">
              <ReviewsBrowser reviews={data.reviews} />
            </div>
          </div>
        )}

        <div className="text-center">
          <ButtonLink href={data.mapsUrl} size="lg">
            Read All Reviews on Google <ExternalLink className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
