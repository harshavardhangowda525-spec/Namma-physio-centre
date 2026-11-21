import type { Metadata } from "next";
import { ArrowRight, Compass, Eye, HandHeart, Target, UserRound, MapPin } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Media } from "@/components/media";
import { MaskReveal, Parallax, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { Gallery } from "@/components/gallery";
import { clinic, doctor } from "@/content/clinic";

export const metadata: Metadata = {
  title: "About Our Clinic",
  description: `Meet ${doctor.name} and learn about ${clinic.name}, a physiotherapy centre serving patients in JP Nagar, Bengaluru.`,
  alternates: { canonical: "/about" },
};

const TBC = <span className="rounded-md bg-amber-50 px-2 py-0.5 text-sm text-amber-800 ring-1 ring-amber-200">To be confirmed by the clinic</span>;

const philosophy = [
  { icon: Target, title: "Our mission", body: "To help every patient move with less pain and more confidence through careful assessment, honest guidance and rehabilitation tailored to their life." },
  { icon: Eye, title: "Our approach", body: "We listen first, explain clearly and build each programme step by step, adjusting as you progress." },
  { icon: HandHeart, title: "Our care promise", body: "Respect for your time, your questions and your goals — whether we see you at the clinic or at home." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About Our Clinic" title="Care that helps you move forward" lead={`${clinic.name} is a physiotherapy centre serving patients in the JP Nagar area of Bengaluru, at our clinic and through home visits.`} />

      {/* Doctor profile */}
      <section className="container-px grid items-start gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Parallax offset={30}>
          <MaskReveal className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
            <Media src={doctor.photo} alt={`Portrait of ${doctor.name}`} icon={UserRound} variant={2} className="h-full w-full" priority label="Placeholder · photo of Dr. Sunil to be supplied" />
          </MaskReveal>
        </Parallax>
        <div>
          <Reveal><span className="eyebrow">Our Physiotherapist</span></Reveal>
          <Reveal delay={0.1}><h2 className="section-title mt-5">{doctor.name}</h2></Reveal>
          <Reveal delay={0.15}><p className="mt-2 text-lg text-teal-700">{doctor.role}</p></Reveal>

          <Reveal delay={0.2}>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="card p-5">
                <dt className="text-sm font-semibold text-navy-900">Qualifications</dt>
                <dd className="mt-2 text-muted">{doctor.qualifications.length ? doctor.qualifications.join(", ") : TBC}</dd>
              </div>
              <div className="card p-5">
                <dt className="text-sm font-semibold text-navy-900">Experience</dt>
                <dd className="mt-2 text-muted">{doctor.experience ?? TBC}</dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={0.25}>
            <h3 className="mt-10 font-sans text-sm font-semibold tracking-wide text-navy-900 uppercase">Areas of treatment</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {doctor.areasOfTreatment.map((a) => (
                <li key={a} className="rounded-full bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-800 ring-1 ring-teal-100">{a}</li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.3}>
            <h3 className="mt-10 font-sans text-sm font-semibold tracking-wide text-navy-900 uppercase">Approach to physiotherapy</h3>
            <p className="lead mt-3">
              Patients describe {doctor.shortName} as friendly and professional, with clear explanations through each stage of recovery, including rehabilitation after knee injuries such as meniscus and MPFL tears.
            </p>
            <p className="mt-4 text-muted">
              Every programme begins with understanding the person, not just the injury: how it affects your day, what you want to return to, and what pace is right for you.
            </p>
          </Reveal>
          <Reveal delay={0.35}><div className="mt-9"><ButtonLink href="/book">Book with {doctor.shortName} <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink></div></Reveal>
        </div>
      </section>

      {/* Clinic introduction */}
      <section className="container-px py-24 sm:py-32">
        <div className="grid gap-10 rounded-[2.5rem] bg-cream p-8 sm:p-14 lg:grid-cols-2">
          <Reveal>
            <span className="eyebrow">Our Clinic</span>
            <h2 className="section-title mt-5">A neighbourhood clinic with a personal touch</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="lead">
              Located on Jambusawari Dinne Main Road in JP Nagar 8th Phase, {clinic.name} offers physiotherapy consultations and rehabilitation in a calm, clean setting. For patients who find travel difficult, home visits can be requested.
            </p>
            <p className="mt-5 flex items-start gap-2 text-sm text-muted"><MapPin className="mt-0.5 h-4 w-4 text-teal-600" aria-hidden /> {clinic.address.line2}, {clinic.address.city} {clinic.address.postalCode}</p>
          </Reveal>
        </div>
      </section>

      {/* Mission & philosophy — DRAFT copy pending client approval */}
      <section className="container-px">
        <Reveal><SectionHeading eyebrow="Mission & Care Philosophy" title="What guides our care" /></Reveal>
        <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
          {philosophy.map((p) => (
            <StaggerItem key={p.title}>
              <div className="group card h-full p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-[var(--shadow-glow)]"><p.icon className="h-5 w-5" aria-hidden /></span>
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
          <Reveal><SectionHeading align="left" eyebrow="Clinic Gallery" title="Inside Namma Physio Centre" /></Reveal>
          <Reveal delay={0.1}><p className="flex items-center gap-2 text-sm text-muted"><Compass className="h-4 w-4" aria-hidden /> Tap a photo to view it larger</p></Reveal>
        </div>
        <div className="mt-12"><Gallery /></div>
      </section>
    </>
  );
}
