import Link from "next/link";
import { MapPin, Navigation, Phone } from "lucide-react";
import { clinic, fullAddress } from "@/content/clinic";
import { publicServices } from "@/content/services";
import { Logo } from "./ui";
import { navLinks } from "@/content/nav";

export function Footer() {
  const year = new Date().getFullYear();
  const socials = Object.entries(clinic.social);
  return (
    <footer className="relative mt-24 overflow-hidden bg-navy-950 text-white/80">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(50% 60% at 90% 0%, rgb(22 151 141 / .25), transparent 70%), radial-gradient(40% 50% at 0% 100%, rgb(92 200 224 / .12), transparent 70%)" }} />
      <div className="container-px relative grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1.3fr] lg:py-20">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/65">
            Personalised physiotherapy and rehabilitation care for patients in JP Nagar and surrounding areas of Bengaluru, at the clinic or at home.
          </p>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-3">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm capitalize text-white/70 hover:text-teal-200">{name}</a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-teal-200 uppercase">Explore</h2>
          <ul className="mt-5 space-y-2.5 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}><Link href={l.href} className="transition hover:text-white">{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-teal-200 uppercase">Services</h2>
          <ul className="mt-5 space-y-2.5 text-sm">
            {publicServices.map((s) => (
              <li key={s.slug}><Link href={`/services?service=${s.slug}`} className="transition hover:text-white">{s.title}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-teal-200 uppercase">Visit or call</h2>
          <address className="mt-5 space-y-4 text-sm not-italic">
            <p className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden />{fullAddress}</p>
            <p><a href={`tel:${clinic.phoneE164}`} className="flex items-center gap-3 hover:text-white"><Phone className="h-4 w-4 text-teal-300" aria-hidden />{clinic.phoneDisplay}</a></p>
            <p><a href={clinic.google.directionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-white"><Navigation className="h-4 w-4 text-teal-300" aria-hidden />Get directions on Google Maps</a></p>
          </address>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-px flex flex-col gap-3 py-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <p>© {year} {clinic.name}. All rights reserved.</p>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Use</Link>
          </nav>
          <p className="text-white/40">Website Designed &amp; Developed by <span className="text-white/60">Infinity Web &amp; Apps</span></p>
        </div>
      </div>
    </footer>
  );
}
