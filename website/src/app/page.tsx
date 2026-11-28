import { Suspense } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  HeartHandshake,
  Home as HomeIcon,
  MessageCircleHeart,
  Route,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { ButtonLink, GoogleG, SectionHeading, Stars } from "@/components/ui";
import { Counter, Magnetic, MaskReveal, Parallax, Reveal, Stagger, StaggerItem, TextReveal } from "@/components/motion";
import { FloatingShapes } from "@/components/floating";
import { Media } from "@/components/media";
import { ServicesGrid } from "@/components/services";
import { ReviewsCarousel } from "@/components/reviews";
import { clinic, doctor } from "@/content/clinic";
import { featuredServices } from "@/content/services";
import { reviewHighlights } from "@/content/reviews";
import { getReviews } from "@/lib/reviews";

const reasons = [
  {
    icon: Route,
    title: "Personalised rehabilitation",
    body: "Every program starts with an individualized clinical assessment of your condition, functional limitations and everyday recovery goals.",
  },
  {
    icon: HeartHandshake,
    title: "Patient-centred care",
    body: "You are involved in every decision, with clear explanations and time to ask questions about each stage of your treatment protocol.",
  },
  {
    icon: HomeIcon,
    title: "Clinic or home visits",
    body: "Consult with us at our JP Nagar 8th Phase clinic, or request customized home physiotherapy when travelling isn't practical.",
  },
  {
    icon: ClipboardList,
    title: "Clear treatment guidance",
    body: "Structured home exercise guidance and practical movement education you can follow comfortably between sessions.",
  },
  {
    icon: MessageCircleHeart,
    title: "Support through recovery",
    body: "Regular progress reassessment ensures your rehabilitation protocol adapts steadily as your mobility and strength improve.",
  },
];

const evidenceHighlights = [
  { icon: Stethoscope, label: "Comprehensive clinical assessment" },
  { icon: BookOpenCheck, label: "Evidence-informed treatment techniques" },
  { icon: ClipboardCheck, label: "Customized treatment protocols" },
  { icon: Target, label: "Individualized rehabilitation goals" },
  { icon: TrendingUp, label: "Regular progress assessment" },
  { icon: Activity, label: "Patient education and recovery guidance" },
];

export default async function HomePage() {
  const data = await getReviews();

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative isolate overflow-hidden pt-32 pb-20 sm:pt-40 lg:pt-48 lg:pb-28">
        <div aria-hidden className="bg-mesh absolute inset-0 -z-10" />
        <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
        <FloatingShapes />
        <div className="container-px grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal>
              <a
                href={data.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="glass inline-flex items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-lift)]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
                  <GoogleG size={18} />
                </span>
                <span className="text-sm font-semibold text-navy-900">{data.rating.toFixed(1)}</span>
                <Stars rating={data.rating} size={14} />
                <span className="text-sm text-muted">{data.total} Google reviews</span>
              </a>
            </Reveal>
            <h1 className="mt-7 text-[2.75rem] leading-[1.02] font-medium sm:text-6xl lg:text-[4.5rem]">
              <TextReveal text="Move Better." delay={0.15} />
              <br />
              <TextReveal text="Recover Stronger." delay={0.35} className="text-gradient" />
              <br />
              <TextReveal text="Live Healthier." delay={0.55} />
            </h1>
            <Reveal delay={0.8}>
              <p className="lead mt-7 max-w-xl">
                Evidence-based physiotherapy and customized treatment protocols at {clinic.name}, JP Nagar 8th Phase, Bengaluru — planned around your clinical assessment, functional needs and recovery goals.
              </p>
            </Reveal>
            <Reveal delay={0.95}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Magnetic>
                  <ButtonLink href="/book" size="lg" className="w-full sm:w-auto">
                    <CalendarCheck className="h-5 w-5" aria-hidden /> Book an Appointment
                  </ButtonLink>
                </Magnetic>
                <ButtonLink href="/services" variant="secondary" size="lg">
                  Explore Our Services <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          <div className="relative">
            <Parallax offset={30}>
              <MaskReveal
                delay={0.3}
                className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)] sm:aspect-[5/5] lg:aspect-[4/5]"
              >
                <Media
                  src="/images/site/hero.jpg"
                  alt="A patient doing a guided lunge exercise with a physiotherapist"
                  icon={Sparkles}
                  className="h-full w-full"
                  priority
                  sizes="(min-width: 1024px) 45vw, 100vw"
                />
              </MaskReveal>
            </Parallax>
            <Reveal delay={1.1} className="absolute -bottom-6 -left-4 sm:-left-10">
              <div className="glass animate-float-slow flex items-center gap-3 rounded-2xl p-4 shadow-[var(--shadow-lift)]">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-500 text-white">
                  <HomeIcon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy-900">Clinic &amp; Home Physiotherapy</p>
                  <p className="text-xs text-muted">Customized rehabilitation care</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={1.25} className="absolute -top-4 right-2 sm:-right-6">
              <div className="glass animate-float flex items-center gap-3 rounded-2xl p-3.5 pr-5 shadow-[var(--shadow-lift)]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-navy-900 text-teal-200">
                  <Award className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy-900">8+ Years Experience</p>
                  <p className="text-xs text-muted">Assessment-led protocols</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- STATS (verified clinical highlights) ---------------- */}
      <section aria-label="Clinic at a glance" className="container-px">
        <Reveal>
          <dl className="card grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex flex-col justify-center p-7 text-center">
              <dt className="text-sm font-medium text-muted">Google Rating</dt>
              <dd className="mt-1 font-display text-5xl font-semibold text-navy-900">
                <Counter to={data.rating} decimals={1} />
                <span className="text-2xl font-normal text-muted">/5</span>
              </dd>
              <p className="mt-2 text-xs text-muted">Patient rating on Google Maps</p>
            </div>

            <div className="flex flex-col justify-center bg-gradient-to-b from-teal-50/55 to-transparent p-7 text-center">
              <dt className="text-sm font-semibold tracking-wide text-teal-800">Clinical Experience</dt>
              <dd className="mt-1 flex items-baseline justify-center gap-2">
                <span className="font-display text-5xl font-semibold text-navy-900 sm:text-[3.25rem]">
                  <Counter to={doctor.experienceYears} suffix="+" />
                </span>
                <span className="font-display text-2xl font-medium text-teal-700">Years</span>
              </dd>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted">
                Over eight years of hands-on physiotherapy and rehabilitation experience.
              </p>
            </div>

            <div className="flex flex-col justify-center p-7 text-center">
              <dt className="text-sm font-medium text-muted">Reviews on Google</dt>
              <dd className="mt-1 font-display text-5xl font-semibold text-navy-900">
                <Counter to={data.total} />
              </dd>
              <p className="mt-2 text-xs text-muted">Shared by patients in Bengaluru</p>
            </div>
          </dl>
        </Reveal>
      </section>

      {/* ---------------- WHY CHOOSE + EVIDENCE-BASED PRACTICE ---------------- */}
      <section className="container-px py-24 sm:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="Why Namma Physiotherapy Centre"
            title={
              <>
                Why choose <span className="text-gradient">{clinic.name}?</span>
              </>
            }
            lead="Structured, patient-centered care grounded in clinical assessment, scientific evidence and individualized rehabilitation planning."
          />
        </Reveal>

        {/* Prominent Feature: Evidence-Based Physiotherapy Practice */}
        <Reveal delay={0.1}>
          <div className="mt-14 overflow-hidden rounded-[2rem] border border-teal-200/80 bg-gradient-to-br from-white via-teal-50/40 to-cyan-soft/45 p-7 shadow-[var(--shadow-soft)] sm:p-10 lg:p-12">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-teal-200 uppercase">
                  <BookOpenCheck className="h-3.5 w-3.5" aria-hidden />
                  Clinical Standard of Care
                </span>
                <h3 className="mt-4 font-display text-2xl font-medium text-navy-900 sm:text-3xl">
                  Evidence-Based Physiotherapy Practice
                </h3>
                <p className="mt-4 text-[15.5px] leading-relaxed text-ink/85 sm:text-base">
                  At Namma Physiotherapy Centre, treatment decisions are guided by current scientific evidence, clinical expertise and individual patient needs. Each rehabilitation program begins with a clinical assessment, followed by a customized treatment protocol designed around the patient&apos;s condition, functional abilities and recovery goals.
                </p>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2">
                {evidenceHighlights.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-start gap-3 rounded-2xl border border-line/80 bg-white/90 p-4 shadow-[0_1px_2px_rgb(11_31_58/0.03)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                      <item.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="text-sm leading-snug font-medium text-navy-900">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Existing Approved Why Choose Us Cards */}
        <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {reasons.map((r) => (
            <StaggerItem key={r.title}>
              <div className="group card relative h-full overflow-hidden p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <div
                  aria-hidden
                  className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-teal-100/60 blur-2xl transition-transform duration-700 group-hover:scale-150"
                />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-navy-900 text-teal-200 transition-colors duration-500 group-hover:bg-teal-500 group-hover:text-white">
                  <r.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="relative mt-5 font-sans text-lg font-semibold">{r.title}</h3>
                <p className="relative mt-2 text-[15px] leading-relaxed text-muted">{r.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---------------- FEATURED SERVICES (7 Primary Services) ---------------- */}
      <section className="relative bg-cream py-24 sm:py-32">
        <div aria-hidden className="bg-mesh absolute inset-0 opacity-70" />
        <div className="container-px relative">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <Reveal>
              <SectionHeading
                align="left"
                eyebrow="Our Services"
                title="Focused rehabilitation for real recovery"
                lead="Explore our primary physiotherapy and rehabilitation services, delivered through assessment-led, customized treatment protocols at the clinic and at home."
              />
            </Reveal>
            <Reveal delay={0.1}>
              <ButtonLink href="/services" variant="secondary">
                View All Services <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            </Reveal>
          </div>
          <div className="mt-14">
            <Suspense>
              <ServicesGrid services={featuredServices} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ---------------- MEET OUR PHYSIOTHERAPIST ---------------- */}
      <section className="container-px grid items-center gap-14 py-24 sm:py-32 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="relative">
          <Parallax offset={32}>
            <MaskReveal className="relative aspect-[4/5] max-w-md overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)] lg:mx-auto">
              <Media
                src={doctor.photo}
                alt={`Portrait of ${doctor.name}`}
                icon={UserRound}
                variant={2}
                className="h-full w-full"
                label="Authentic clinic portrait · to be supplied"
              />
            </MaskReveal>
          </Parallax>
          <Reveal delay={0.25} className="mt-4 flex justify-center lg:mt-0 lg:block">
            <div className="glass inline-flex items-center gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-lift)] lg:absolute lg:-bottom-5 lg:left-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-900 font-display text-lg font-semibold text-teal-200">
                {doctor.experienceHighlight.replace(" Years", "")}
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-900">{doctor.experience}</p>
                <p className="text-xs text-muted">Individualized clinical rehabilitation</p>
              </div>
            </div>
          </Reveal>
        </div>

        <div>
          <Reveal>
            <span className="eyebrow">Meet Our Physiotherapist</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="section-title mt-5">{doctor.name}</h2>
            <p className="mt-2 font-sans text-base font-semibold text-teal-700">{doctor.experience}</p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="lead mt-5">{doctor.biography[0]}</p>
            <p className="mt-4 text-[15.5px] leading-relaxed text-muted">{doctor.biography[1]}</p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-7 font-sans text-xs font-semibold tracking-wider text-navy-900 uppercase">
              Areas of Clinical Care
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {doctor.areasOfTreatment.map((a) => (
                <li
                  key={a}
                  className="rounded-full bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-800 ring-1 ring-teal-100"
                >
                  {a}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.4}>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/about">
                Full Practitioner Profile <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/book" variant="secondary">
                <CalendarCheck className="h-4 w-4" aria-hidden /> Request an Appointment
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- REVIEWS ---------------- */}
      <section className="relative overflow-hidden bg-navy-950 py-24 text-white sm:py-32">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(45% 60% at 15% 0%, rgb(22 151 141 / .3), transparent 70%), radial-gradient(40% 50% at 100% 100%, rgb(92 200 224 / .18), transparent 70%)",
          }}
        />
        <div className="container-px relative">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <Reveal>
              <span className="eyebrow border-white/15 bg-white/5 text-teal-200">Patient Reviews</span>
              <h2 className="section-title mt-5 !text-white">Trusted by patients across JP Nagar</h2>
              <p className="mt-4 flex flex-wrap items-center gap-3 text-white/70">
                <GoogleG /> <span className="font-semibold text-white">{data.rating.toFixed(1)}</span>{" "}
                <Stars rating={data.rating} /> from {data.total} Google reviews
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <ButtonLink href="/reviews" variant="light">
                Read Patient Experiences <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            </Reveal>
          </div>
          <div className="mt-14 text-ink">
            <ReviewsCarousel reviews={data.reviews} highlights={reviewHighlights} mapsUrl={data.mapsUrl} />
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="container-px pt-24 sm:pt-32">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-teal-500 via-teal-600 to-navy-800 px-6 py-16 text-center text-white shadow-[var(--shadow-glow)] sm:px-16 sm:py-24">
            <FloatingShapes subtle />
            <div aria-hidden className="absolute -top-24 -left-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <h2 className="mx-auto max-w-3xl text-3xl leading-tight font-medium !text-white sm:text-5xl">
              Ready to Take the Next Step Towards Better Movement?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/85">
              Submit your preferred date and time online. Our physiotherapist will review your request and send a confirmation once approved.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Magnetic>
                <ButtonLink href="/book?type=clinic" variant="light" size="lg" className="w-full sm:w-auto">
                  <CalendarCheck className="h-5 w-5" aria-hidden /> Book Clinic Visit
                </ButtonLink>
              </Magnetic>
              <Magnetic>
                <ButtonLink
                  href="/book?type=home"
                  variant="light"
                  size="lg"
                  className="w-full !bg-white/10 !text-white ring-1 ring-white/30 backdrop-blur hover:!bg-white/20 sm:w-auto"
                >
                  <HomeIcon className="h-5 w-5" aria-hidden /> Request Home Visit
                </ButtonLink>
              </Magnetic>
            </div>
            <p className="mt-8 text-sm text-white/75">
              Prefer to speak directly? Call{" "}
              <Link href={`tel:${clinic.phoneE164}`} className="font-semibold text-white underline-offset-4 hover:underline">
                {clinic.phoneDisplay}
              </Link>
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
