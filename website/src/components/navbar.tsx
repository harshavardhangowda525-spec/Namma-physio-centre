"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { CalendarCheck, Menu, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo, buttonClass } from "./ui";
import { Magnetic } from "./motion";
import { clinic } from "@/content/clinic";
import { navLinks } from "@/content/nav";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const menuBtn = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 20));
  useEffect(() => setOpen(false), [pathname]);

  // Hide public navbar on standalone doctor approval / patient response screens for distraction-free focus
  const isStandaloneFlow = pathname.startsWith("/appointments/");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuBtn.current?.focus();
      }
      if (e.key === "Tab" && panelRef.current) {
        const els = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a,button"));
        const f = els[0];
        const l = els[els.length - 1];
        if (e.shiftKey && document.activeElement === f) {
          e.preventDefault();
          l.focus();
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isStandaloneFlow) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-full bg-navy-900 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50 px-2.5 pt-2.5 sm:px-5 sm:pt-3"
      >
        <div
          className={`container-px rounded-2xl transition-all duration-500 lg:rounded-3xl ${
            scrolled
              ? "glass max-w-7xl shadow-[var(--shadow-soft)]"
              : "border border-line/60 bg-ivory/90 shadow-[0_2px_16px_-8px_rgb(11_31_58/0.08)] backdrop-blur-md"
          }`}
        >
          {/* Upper Row: Prominent Clinic Identity + Appointment Enquiry CTA */}
          <div className="flex min-h-16 items-center justify-between gap-3 py-2.5 sm:py-3">
            <Link href="/" aria-label={`${clinic.name}, home`} className="min-w-0 rounded-xl">
              <Logo prominent />
            </Link>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <a
                href={`tel:${clinic.phoneE164}`}
                className="hidden items-center gap-2 rounded-full border border-line bg-white/90 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:border-teal-300 hover:text-teal-700 xl:inline-flex"
              >
                <Phone className="h-3.5 w-3.5 text-teal-600" aria-hidden />
                {clinic.phoneDisplay}
              </a>

              <Magnetic className="hidden sm:block">
                <Link href="/book" className={buttonClass("primary", "sm", "h-11 px-5")}>
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                  Book an Appointment
                </Link>
              </Magnetic>

              <Link
                href="/book"
                aria-label="Book an Appointment"
                className="grid h-10 w-10 place-items-center rounded-full bg-navy-900 text-white shadow-[var(--shadow-soft)] sm:hidden"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden />
              </Link>

              <button
                ref={menuBtn}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/90 text-navy-900 backdrop-blur sm:h-11 sm:w-11 lg:hidden"
              >
                <AnimatePresence initial={false} mode="wait">
                  <motion.span
                    key={open ? "x" : "m"}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </div>

          {/* Lower Navigation Row (Desktop) */}
          <nav
            aria-label="Primary"
            className="hidden border-t border-line/70 py-1.5 lg:block"
          >
            <ul className="flex items-center gap-1.5">
              {navLinks.map((l) => {
                const active = isActive(l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative inline-flex items-center rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors ${
                        active ? "font-semibold text-teal-800" : "text-navy-800 hover:text-teal-700"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-0 -z-10 rounded-full bg-teal-50 ring-1 ring-teal-200/80"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </motion.header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-ivory/98 px-6 pt-26 pb-8 backdrop-blur-xl lg:hidden"
            initial={{ clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 40px) 40px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 40px) 40px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <ul className="flex flex-col gap-1">
              {navLinks.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={l.href}
                    aria-current={isActive(l.href) ? "page" : undefined}
                    className={`block rounded-2xl px-4 py-3 font-display text-2xl sm:text-3xl ${
                      isActive(l.href) ? "bg-teal-50 text-teal-700" : "text-navy-900"
                    }`}
                  >
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <motion.div
              className="mt-auto grid gap-3 pt-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Link href="/book" className={buttonClass("primary", "lg")}>
                <CalendarCheck className="h-5 w-5" aria-hidden /> Book an Appointment
              </Link>
              <a href={`tel:${clinic.phoneE164}`} className={buttonClass("secondary", "lg")}>
                <Phone className="h-5 w-5" aria-hidden /> Call {clinic.phoneDisplay}
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
