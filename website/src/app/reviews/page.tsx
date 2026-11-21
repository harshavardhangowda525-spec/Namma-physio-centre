import type { Metadata } from "next";
import { ExternalLink, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { HighlightCard, RatingSummary, ReviewsBrowser, ReviewsCarousel } from "@/components/reviews";
import { Reveal } from "@/components/motion";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { reviewHighlights } from "@/content/reviews";
import { getReviews } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Patient Reviews",
  description: "Read what patients say about Namma Physio Centre on Google.",
  alternates: { canonical: "/reviews" },
};

export default async function ReviewsPage() {
  const data = await getReviews();
  const hasReviews = data.reviews.length > 0;

  return (
    <>
      <PageHeader eyebrow="Patient Reviews" title="Patient experiences" lead="Authentic reviews from patients on Google." />
      <section className="container-px space-y-12">
        <Reveal><RatingSummary rating={data.rating} total={data.total} mapsUrl={data.mapsUrl} /></Reveal>

        <Reveal>
          <p className="flex items-start gap-2 rounded-2xl bg-cyan-soft/60 p-4 text-sm text-navy-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
            <span>
              {hasReviews
                ? `This page shows ${data.reviews.length} of ${data.total} Google reviews — the reviews currently available to us through Google's official services${data.importedCount ? " and an authorised import" : ""}. `
                : "Full review text will appear here once the clinic's Google integration is connected. "}
              To read every review, please visit our Google listing.
            </span>
          </p>
        </Reveal>

        {hasReviews ? (
          <>
            <ReviewsCarousel reviews={data.reviews.slice(0, 9)} highlights={[]} mapsUrl={data.mapsUrl} />
            {data.reviews.length > 3 && (
              <div className="pt-8">
                <SectionHeading align="left" title="Browse reviews" />
                <div className="mt-8"><ReviewsBrowser reviews={data.reviews} /></div>
              </div>
            )}
          </>
        ) : (
          <div>
            <h2 className="text-2xl">Review highlights</h2>
            <p className="mt-2 text-sm text-muted">Brief summaries of what some patients wrote. Read their full reviews on Google.</p>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {reviewHighlights.map((h) => <HighlightCard key={h.author} h={h} mapsUrl={data.mapsUrl} />)}
            </div>
          </div>
        )}

        <div className="text-center">
          <ButtonLink href={data.mapsUrl} size="lg">Read All Reviews on Google <ExternalLink className="h-4 w-4" aria-hidden /></ButtonLink>
        </div>
      </section>
    </>
  );
}
