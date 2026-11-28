import type { Metadata } from "next";
import {
  Award,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Eye,
  HandHeart,
  MapPin,
  Phone,
  Stethoscope,
  Target,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Media } from "@/components/media";
import { MaskReveal, Parallax, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { Gallery } from "@/components/gallery";
import { clinic, doctor } from "@/content/clinic";

export const metadata: Metadata = {
  title: "Meet Our Physiotherapist & Clinic",
  description: `Meet ${doctor.name} (${doctor.experience}) and learn about evidence-based physiotherapy and customized rehabilitation protocols at ${clinic.name}, JP Nagar 8th Phase, Bengaluru.`,
  alternates: { canonical: "/about" },
};

const TBC = (
  <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
    Pending clinic certificate verification
  </span>
);

const philosophy = [
  {
    icon: Target,
    title: "Our mission",
    body: "To help every patient improve movement, build strength and progress toward greater functional independence through careful assessment, honest guidance and customized rehabilitation protocols.",
  },
  {
    icon: Eye,
    title: "Evidence-based approach",
    body: "Treatment decisions combine scientific evidence, clinical experience and patient-specific assessment — never an identical template applied to every condition.",
  },
  {
    icon: HandHeart,
    title: "Our care promise",
    body: "Respect for your time, your questions and your recovery goals — whether we support you at our JP Nagar clinic or through home physiotherapy.",
  },
];

const practiceIcons = [Stethoscope, BookOpenCheck, ClipboardCheck, Target];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About Our Clinic"
        title="Evidence-based care tailored to you"
        lead={`${clinic.name} provides assessment-led physiotherapy and customized rehabilitation programs for patients in JP Nagar 8th Phase and surrounding areas of Bengaluru, both at our clinic and at home.`}
      />

      {/* ---------------- PRACTITIONER PROFILE ---------------- */}
      <section aria-labelledby="practitioner-heading" className="container-px">
        <div className="overflow-hidden rounded-[2.5rem] border border-line/80 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-10 lg:p-14">
          <div className="grid items-start gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14">
            {/* Left column: Authentic photograph slot + Experience highlight + Credentials */}
            <div className="space-y-6">
              <Parallax offset={20}>
                <MaskReveal className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
                  <Media
                    src={doctor.photo}
                    alt={`Portrait of ${doctor.name}`}
                    icon={UserRound}
                    variant={2}
                    className="h-full w-full"
                    priority
                    label="Authentic portrait of Sunil Kumar · to be supplied"
                  />
                </MaskReveal>
              </Parallax>

              {/* Prominent clinical experience card (doctor.experienceHighlight) */}
              <div className="rounded-3xl bg-navy-900 p-6 text-white shadow-[var(--shadow-lift)]">
                <div className="flex items-center gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/30">
                    <Award className="h-7 w-7" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-3xl font-semibold text-white">{doctor.experienceHighlight}</p>
                    <p className="text-sm font-medium text-teal-200">Clinical Physiotherapy Experience</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-white/75">
                  Hands-on clinical experience assessing and rehabilitating musculoskeletal, orthopedic, sports, post-surgical, neurological and mobility-related conditions.
                </p>
              </div>

              {/* Verified Credentials Card */}
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-line/80 bg-ivory p-4">
                  <dt className="text-xs font-semibold tracking-wider text-navy-900 uppercase">Educational Qualifications</dt>
                  <dd className="mt-2 text-sm text-muted">
                    {doctor.qualifications.length ? doctor.qualifications.join(", ") : TBC}
                  </dd>
                </div>
                {doctor.certifications.length > 0 && (
                  <div className="rounded-2xl border border-line/80 bg-ivory p-4">
                    <dt className="text-xs font-semibold tracking-wider text-navy-900 uppercase">Verified Certifications</dt>
                    <dd className="mt-2 text-sm text-muted">{doctor.certifications.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Right column: Biography, Clinical Care Scope, Differentiators & CTA */}
            <div>
              <Reveal>
                <span className="eyebrow">Meet Our Physiotherapist</span>
              </Reveal>
              <Reveal delay={0.08}>
                <h2 id="practitioner-heading" className="section-title mt-5">
                  {doctor.name}
                </h2>
                <p className="mt-2 text-lg font-semibold text-teal-700">
                  {doctor.role} · {doctor.experience}
                </p>
              </Reveal>

              {/* Verified Biography */}
              <Reveal delay={0.15}>
                <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-ink/85">
                  {doctor.biography.map((paragraph, idx) => (
                    <p key={idx} className={idx === 0 ? "lead !text-navy-900/90" : ""}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </Reveal>

              {/* Areas of Clinical Care */}
              <Reveal delay={0.22}>
                <div className="mt-9">
                  <h3 className="font-sans text-xs font-semibold tracking-[0.14em] text-navy-900 uppercase">
                    Areas of Clinical Care
                  </h3>
                  <ul className="mt-3.5 flex flex-wrap gap-2">
                    {doctor.areasOfTreatment.map((area) => (
                      <li
                        key={area}
                        className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-800 ring-1 ring-teal-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" aria-hidden />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              {/* Evidence-Based & Customized Approach Differentiators */}
              <Reveal delay={0.28}>
                <div className="mt-9">
                  <h3 className="font-sans text-xs font-semibold tracking-[0.14em] text-navy-900 uppercase">
                    What Differentiates Our Approach
                  </h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {doctor.practiceHighlights.map((h, i) => {
                      const Icon = practiceIcons[i % practiceIcons.length];
                      return (
                        <div key={h.title} className="rounded-2xl border border-line/80 bg-cream/65 p-4">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-teal-700 shadow-xs ring-1 ring-line">
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <h4 className="font-sans text-sm font-semibold text-navy-900">{h.title}</h4>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-muted">{h.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Reveal>

              {/* Appointment Enquiry CTA */}
              <Reveal delay={0.34}>
                <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-7">
                  <ButtonLink href="/book" size="lg">
                    <CalendarCheck className="h-5 w-5" aria-hidden /> Request Appointment with {doctor.shortName}
                  </ButtonLink>
                  <ButtonLink href={`tel:${clinic.phoneE164}`} variant="secondary" size="lg">
                    <Phone className="h-4 w-4" aria-hidden /> Call {clinic.phoneDisplay}
                  </ButtonLink>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Clinic introduction */}
      <section className="container-px py-24 sm:py-32">
        <div className="grid gap-10 rounded-[2.5rem] bg-cream p-8 sm:p-14 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">Our Clinic</span>
            <h2 className="section-title mt-5">A calm neighbourhood setting for structured rehabilitation</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="lead">
              Located on Jambusawari Dinne Main Road in JP Nagar 8th Phase, {clinic.name} offers individualized physiotherapy assessments and customized rehabilitation programs in a clean, welcoming environment. For older adults, post-surgical patients and individuals with limited functional mobility, home physiotherapy visits can be requested.
            </p>
            <p className="mt-5 flex items-start gap-2 text-sm text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden /> {clinic.address.line1}, {clinic.address.line2}, {clinic.address.city} {clinic.address.postalCode}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mission & philosophy */}
      <section className="container-px">
        <Reveal>
          <SectionHeading eyebrow="Care Philosophy" title="What guides every treatment plan" />
        </Reveal>
        <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
          {philosophy.map((p) => (
            <StaggerItem key={p.title}>
              <div className="group card h-full p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-[var(--shadow-glow)]">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-2xl">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{p.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Gallery */}
      <section className="container-px py-24 sm:py-32">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="Clinic Gallery"
              title="A calm space for recovery"
              lead="Illustrative clinical images. Authentic photographs of the clinic and practitioner are pending upload."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Compass className="h-4 w-4" aria-hidden /> Tap an image to view larger
            </p>
          </Reveal>
        </div>
        <div className="mt-12">
          <Gallery />
        </div>
      </section>
    </>
  );
}
