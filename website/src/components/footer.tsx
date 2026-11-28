"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, MapPin, Navigation, Phone } from "lucide-react";
import { clinic, developerAttribution, fullAddress } from "@/content/clinic";
import { publicServices } from "@/content/services";
import { Logo } from "./ui";
import { navLinks } from "@/content/nav";

function InfinityMark() {
  return (
    <svg width="20" height="12" viewBox="0 0 28 16" fill="none" aria-hidden className="shrink-0 text-teal-300 transition-transform duration-300 group-hover:scale-110">
      <path
        d="M7.5 3C4.46 3 2 5.24 2 8s2.46 5 5.5 5c2.45 0 4.3-1.46 6.5-5 2.2-3.54 4.05-5 6.5-5C23.54 3 26 5.24 26 8s-2.46 5-5.5 5c-2.45 0-4.3-1.46-6.5-5-2.2 3.54-4.05 5-6.5 5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/appointments/")) return null;

  const year = new Date().getFullYear();
  const socials = Object.entries(clinic.social);
  return (
    <footer className="relative mt-24 overflow-hidden bg-navy-950 pb-20 text-white/80 sm:pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(50% 60% at 90% 0%, rgb(22 151 141 / .25), transparent 70%), radial-gradient(40% 50% at 0% 100%, rgb(92 200 224 / .12), transparent 70%)",
        }}
      />
      <div className="container-px relative grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.45fr_0.95fr_1.3fr_1.3fr] lg:py-20">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">
            Evidence-based physiotherapy and customized rehabilitation protocols for patients in JP Nagar 8th Phase and surrounding areas of Bengaluru, at the clinic or at home.
          </p>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-3">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm capitalize text-white/70 hover:text-teal-200">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-teal-200 uppercase">Explore</h2>
          <ul className="mt-5 space-y-2.5 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-teal-200 uppercase">Services</h2>
          <ul className="mt-5 space-y-2.5 text-sm">
            {publicServices.map((s) => (
              <li key={s.slug}>
                <Link href={`/services?service=${s.slug}`} className="transition hover:text-white">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-teal-200 uppercase">Visit or call</h2>
          <address className="mt-5 space-y-4 text-sm not-italic">
            <p className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />
              {fullAddress}
            </p>
            <p>
              <a href={`tel:${clinic.phoneE164}`} className="flex items-center gap-3 hover:text-white">
                <Phone className="h-4 w-4 text-teal-300" aria-hidden />
                {clinic.phoneDisplay}
              </a>
            </p>
            <p>
              <a href={clinic.google.directionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-white">
                <Navigation className="h-4 w-4 text-teal-300" aria-hidden />
                Get directions on Google Maps
              </a>
            </p>
          </address>
        </div>
      </div>

      {/* Bottom Legal + Subtle Infinity Web & Apps Attribution */}
      <div className="relative border-t border-white/10">
        <div className="container-px flex flex-col gap-5 py-6 text-xs text-white/50 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p>
              © {year} {clinic.name}. All rights reserved. <span className="text-white/35">Images are illustrative.</span>
            </p>
            <nav aria-label="Legal" className="flex gap-5">
              <Link href="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms of Use
              </Link>
            </nav>
          </div>

          <div className="flex flex-col items-start gap-1.5 lg:items-end">
            <a
              href={developerAttribution.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-left transition-all duration-300 hover:border-teal-400/40 hover:bg-white/[0.07]"
            >
              <InfinityMark />
              <span className="leading-tight">
                <span className="block text-[11.5px] font-medium text-white/80 transition-colors group-hover:text-white">
                  {developerAttribution.label}
                </span>
                <span className="block text-[10px] tracking-wide text-teal-200/75">
                  {developerAttribution.tagline}
                </span>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-white/40 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-200" aria-hidden />
            </a>
            {developerAttribution.showExpandedCta && (
              <a
                href={developerAttribution.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-white/45 underline-offset-4 transition hover:text-teal-200 hover:underline"
              >
                {developerAttribution.expandedCta}
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
