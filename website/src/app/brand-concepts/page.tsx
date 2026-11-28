import type { Metadata } from "next";
import Image from "next/image";
import { Download, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { clinic } from "@/content/clinic";

export const metadata: Metadata = {
  title: "Logo Concepts for Client Review",
  description: `Original logo concepts prepared for ${clinic.name}. Preserves the existing clinic logo until client approval.`,
  robots: { index: false, follow: false },
};

const concepts = [
  {
    slug: "concept-1-kinetic-spine",
    name: "Concept 1 — Kinetic Stride & Spine Alignment",
    rationale:
      "An upward-sweeping movement arc paired with three aligned vertebral equilibrium points — communicating spinal health, restored joint mobility, and steady forward recovery.",
    palette: ["#0B1F3A Deep Medical Blue", "#16978D Clinical Teal", "#3FB5AA Aqua Motion", "#22A37A Subtle Recovery Green"],
  },
  {
    slug: "concept-2-guided-motion",
    name: "Concept 2 — Guided Motion N-Monogram",
    rationale:
      "Two continuous organic ribbons forming both a clean 'N' monogram and a supportive hand guiding a joint-flexion arc — representing personalized rehabilitation and clinical trust.",
    palette: ["#0E7A73 Deep Teal", "#0B1F3A Medical Navy", "#77D0C6 Soft Teal", "#FFFFFF Clean White"],
  },
  {
    slug: "concept-3-vital-balance",
    name: "Concept 3 — Vital Balance & Recovery Ring",
    rationale:
      "A minimalist human figure in balanced forward motion framed within an open protective ring — symbolizing functional independence, balance, and accessible healthcare.",
    palette: ["#0B1F3A Deep Medical Blue", "#16978D Clinical Teal", "#3FB5AA Teal Accent", "#FFFFFF Clean White"],
  },
];

export default function BrandConceptsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Brand Identity Review"
        title="Original clinic logo concepts"
        lead="Prepared for client review and selection. The existing approved mark remains live on the public website until a new concept is formally approved."
      />

      <section className="container-px space-y-14">
        {concepts.map((c) => (
          <article key={c.slug} className="card overflow-hidden p-6 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-100">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> Original Vector Concept · Awaiting Client Approval
                </span>
                <h2 className="mt-3 text-2xl sm:text-3xl">{c.name}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{c.rationale}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.palette.map((p) => (
                  <span key={p} className="rounded-full border border-line bg-ivory px-3 py-1 text-xs font-medium text-navy-800">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Light & Dark Full Stacked Versions */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-line bg-ivory p-8 text-center">
                <p className="mb-4 text-xs font-semibold tracking-wider text-muted uppercase">Full Logo · Light Background</p>
                <Image
                  src={`/brand-concepts/${c.slug}/full-light.svg`}
                  alt={`${c.name} full logo on light background`}
                  width={480}
                  height={220}
                  unoptimized
                  className="mx-auto h-auto max-h-48 w-auto"
                />
              </div>
              <div className="rounded-3xl bg-navy-950 p-8 text-center text-white">
                <p className="mb-4 text-xs font-semibold tracking-wider text-teal-200 uppercase">Full Logo · Dark Background</p>
                <Image
                  src={`/brand-concepts/${c.slug}/full-dark.svg`}
                  alt={`${c.name} full logo on dark background`}
                  width={480}
                  height={220}
                  unoptimized
                  className="mx-auto h-auto max-h-48 w-auto"
                />
              </div>
            </div>

            {/* Horizontal Header & Standalone Icon / Favicon Variations */}
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-line bg-white p-5 md:col-span-2">
                <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Horizontal Header Lockup (Light &amp; Dark)</p>
                <div className="space-y-4">
                  <div className="rounded-xl border border-line/70 bg-ivory p-3">
                    <Image
                      src={`/brand-concepts/${c.slug}/horizontal-header-light.svg`}
                      alt={`${c.name} horizontal header light`}
                      width={560}
                      height={80}
                      unoptimized
                      className="h-auto w-full max-w-md"
                    />
                  </div>
                  <div className="rounded-xl bg-navy-950 p-3">
                    <Image
                      src={`/brand-concepts/${c.slug}/horizontal-header-dark.svg`}
                      alt={`${c.name} horizontal header dark`}
                      width={560}
                      height={80}
                      unoptimized
                      className="h-auto w-full max-w-md"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-5">
                <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Standalone Icon &amp; Square Favicon</p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="text-center">
                    <Image
                      src={`/brand-concepts/${c.slug}/icon-standalone-light.png`}
                      alt={`${c.name} standalone icon PNG`}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16"
                    />
                    <span className="mt-1.5 block text-[11px] text-muted">64px Icon</span>
                  </div>
                  <div className="rounded-xl bg-navy-950 p-2 text-center">
                    <Image
                      src={`/brand-concepts/${c.slug}/icon-standalone-dark.png`}
                      alt={`${c.name} dark standalone icon PNG`}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-14 w-14"
                    />
                    <span className="mt-1 block text-[10px] text-white/70">Dark Icon</span>
                  </div>
                  <div className="text-center">
                    <Image
                      src={`/brand-concepts/${c.slug}/favicon-square.png`}
                      alt={`${c.name} 32px square favicon`}
                      width={32}
                      height={32}
                      unoptimized
                      className="mx-auto h-8 w-8"
                    />
                    <span className="mt-1.5 block text-[11px] text-muted">32px Favicon</span>
                  </div>
                </div>

                {/* Download Links for All Required Asset Formats */}
                <div className="mt-6 border-t border-line pt-4">
                  <p className="text-xs font-semibold text-navy-900">Download Vector SVG &amp; Transparent PNG</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {[
                      ["Full SVG (Light)", "full-light.svg"],
                      ["Full SVG (Dark)", "full-dark.svg"],
                      ["Header SVG", "horizontal-header-light.svg"],
                      ["Header Dark SVG", "horizontal-header-dark.svg"],
                      ["Icon SVG", "icon-standalone-light.svg"],
                      ["Icon PNG", "icon-standalone-light.png"],
                      ["Dark PNG", "icon-standalone-dark.png"],
                      ["Favicon PNG", "favicon-square.png"],
                    ].map(([label, file]) => (
                      <a
                        key={file}
                        href={`/brand-concepts/${c.slug}/${file}`}
                        download={`${c.slug}-${file}`}
                        className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800 ring-1 ring-teal-100 hover:bg-teal-100"
                      >
                        <Download className="h-3 w-3" aria-hidden />
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
