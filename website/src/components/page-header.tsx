import type { ReactNode } from "react";
import { TextReveal, Reveal } from "./motion";
import { FloatingShapes } from "./floating";

export function PageHeader({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 lg:pt-48 sm:pb-20">
      <div aria-hidden className="bg-mesh absolute inset-0 -z-10" />
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <FloatingShapes subtle />
      <div className="container-px text-center">
        <Reveal><span className="eyebrow">{eyebrow}</span></Reveal>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl leading-[1.05] font-medium sm:text-6xl">
          <TextReveal text={title} delay={0.1} />
        </h1>
        {lead && <Reveal delay={0.35}><p className="lead mx-auto mt-6 max-w-2xl">{lead}</p></Reveal>}
        {children && <Reveal delay={0.5}><div className="mt-8">{children}</div></Reveal>}
      </div>
    </section>
  );
}
