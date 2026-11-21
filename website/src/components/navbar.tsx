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

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));
  useEffect(() => setOpen(false), [pathname]);

  // Mobile menu: lock scroll, Escape to close, focus trap.
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
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5"
      >
        <nav
          aria-label="Primary"
          className={`container-px flex h-16 items-center justify-between rounded-full transition-all duration-500 sm:h-[72px] ${
            scrolled ? "glass max-w-6xl shadow-[var(--shadow-soft)]" : "border border-transparent bg-transparent"
          }`}
        >
          <Link href="/" aria-label={`${clinic.name}, home`} className="rounded-xl">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {navLinks.slice(1).map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="relative rounded-full px-3.5 py-2 text-[14.5px] font-medium text-navy-800 transition-colors hover:text-teal-600"
                >
                  {isActive(l.href) && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-teal-50 ring-1 ring-teal-100"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Magnetic className="hidden sm:block">
              <Link href="/book" className={buttonClass("primary", "sm", "h-11 px-5")}>
                <CalendarCheck className="h-4 w-4" aria-hidden />
                Book an Appointment
              </Link>
            </Magnetic>
            <button
              ref={menuBtn}
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white/80 text-navy-900 backdrop-blur lg:hidden"
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
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-ivory/95 px-6 pt-28 pb-8 backdrop-blur-xl lg:hidden"
            initial={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 44px) 44px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <ul className="flex flex-col gap-1">
              {navLinks.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
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
