"use client";
import { Plus } from "lucide-react";

/** Subtle decorative medical motifs. Purely decorative and hidden from assistive tech. */
export function FloatingShapes({ subtle = false }: { subtle?: boolean }) {
  const o = subtle ? "opacity-50" : "opacity-90";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${o}`}>
      <span className="animate-float absolute top-[18%] left-[6%] hidden sm:grid h-12 w-12 place-items-center rounded-2xl bg-white/80 shadow-[var(--shadow-soft)]">
        <Plus className="h-5 w-5 text-teal-500" strokeWidth={2.5} />
      </span>
      <span className="animate-float-slow absolute top-[62%] left-[12%] hidden sm:block h-5 w-5 rounded-full border-2 border-teal-300" />
      <span className="animate-float-slow absolute top-[22%] right-[9%] hidden sm:block h-24 w-24 rounded-full border border-cyan-accent/40" style={{ animationDelay: "-4s" }} />
      <span className="animate-float absolute right-[16%] bottom-[14%] grid h-9 w-9 place-items-center rounded-xl bg-teal-50 ring-1 ring-teal-100" style={{ animationDelay: "-2s" }}>
        <Plus className="h-4 w-4 text-teal-600" strokeWidth={2.5} />
      </span>
      <svg className="animate-float-slow absolute bottom-[8%] left-[38%] w-40 text-teal-300/70" viewBox="0 0 160 40" fill="none" style={{ animationDelay: "-6s" }}>
        <path d="M0 20h40l8-14 12 28 10-20 6 6h84" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
