"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CalendarCheck, CheckCircle2, Home, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Service } from "@/content/services";
import { verifiedDifferentiators } from "@/content/services";
import { serviceIcons } from "./icons";
import { Media } from "./media";
import { staggerItem, Stagger } from "./motion";
import { buttonClass } from "./ui";

export function ServiceCard({ service, index, onOpen }: { service: Service; index: number; onOpen: (s: Service) => void }) {
  const Icon = serviceIcons[service.icon];
  return (
    <motion.article variants={staggerItem} className="h-full">
      <button
        type="button"
        onClick={() => onOpen(service)}
        aria-haspopup="dialog"
        className="group card relative flex h-full w-full flex-col overflow-hidden text-left transition-all duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-teal-200 hover:shadow-[var(--shadow-lift)]"
      >
        <div className="relative aspect-[3/2] overflow-hidden">
          <div className="h-full w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.06]">
            <Media src={service.image} alt={service.title} icon={Icon} variant={index} className="h-full w-full" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-950/30 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </div>
        <div className="flex flex-1 flex-col p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100 transition-colors duration-500 group-hover:bg-teal-500 group-hover:text-white">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            {service.slug === "home-visit-physiotherapy" && (
              <span className="rounded-full bg-cyan-soft px-2.5 py-1 text-[11px] font-semibold text-navy-700">At your home</span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-medium">{service.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{service.short}</p>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-teal-700">
            Learn more
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </span>
        </div>
      </button>
    </motion.article>
  );
}

export function ServicesGrid({ services, syncUrl = false }: { services: Service[]; syncUrl?: boolean }) {
  const [active, setActive] = useState<Service | null>(null);
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!syncUrl) return;
    const slug = params.get("service");
    setActive(slug ? services.find((s) => s.slug === slug) ?? null : null);
  }, [params, services, syncUrl]);

  const open = useCallback(
    (s: Service) => {
      setActive(s);
      if (syncUrl) router.replace(`?service=${s.slug}`, { scroll: false });
    },
    [router, syncUrl],
  );
  const close = useCallback(() => {
    setActive(null);
    if (syncUrl) router.replace("?", { scroll: false });
  }, [router, syncUrl]);

  return (
    <>
      <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s, i) => (
          <ServiceCard key={s.slug} service={s} index={i} onOpen={open} />
        ))}
      </Stagger>
      <ServiceModal service={active} onClose={close} />
    </>
  );
}

export function ServiceModal({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const Icon = service ? serviceIcons[service.icon] : null;
  return (
    <Dialog.Root open={!!service} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {service && Icon && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-navy-950/40 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-[61] flex items-end justify-center outline-none sm:items-center sm:p-6"
                initial={{ opacity: 0, y: 60, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.98 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.target === e.currentTarget && onClose()}
              >
                <div className="relative flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-ivory shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[2rem]">
                  <Dialog.Close
                    className="absolute top-4 right-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-navy-900 shadow-[var(--shadow-soft)] backdrop-blur transition hover:rotate-90 hover:bg-white"
                    aria-label="Close service details"
                  >
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                  <div className="overflow-y-auto overscroll-contain">
                    <motion.div
                      initial={{ clipPath: "inset(0 0 100% 0)" }}
                      animate={{ clipPath: "inset(0 0 0% 0)" }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    >
                      <Media src={service.image} alt={service.title} icon={Icon} variant={1} className="aspect-[3/2] w-full" priority sizes="(min-width: 896px) 896px, 100vw" />
                    </motion.div>
                    <div className="p-6 sm:p-10">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-500 text-white">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="eyebrow">Service</span>
                      </div>
                      <Dialog.Title className="mt-5 font-display text-3xl font-medium text-navy-900 sm:text-4xl">{service.title}</Dialog.Title>
                      <p className="lead mt-4">{service.description}</p>

                      <div className="mt-8 grid gap-5 md:grid-cols-2">
                        <InfoList title="Conditions commonly addressed" items={service.conditions} />
                        <InfoList title="General treatment approach" items={service.approach} />
                        <InfoList title="Potential rehabilitation goals" items={service.goals} />
                        <InfoList title="What to expect at your consultation" items={service.expect} />
                      </div>

                      <div className="mt-6 rounded-3xl bg-gradient-to-br from-teal-50 to-cyan-soft p-6 ring-1 ring-teal-100">
                        <h3 className="font-sans text-sm font-semibold tracking-wide text-teal-700 uppercase">Why patients choose Namma Physio Centre</h3>
                        <ul className="mt-3 grid gap-2 text-[15px] text-navy-800 sm:grid-cols-2">
                          {verifiedDifferentiators.map((d) => (
                            <li key={d} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />{d}</li>
                          ))}
                        </ul>
                      </div>

                      <p className="mt-6 text-xs leading-relaxed text-muted">
                        Every patient is different. Outcomes and recovery times vary, and your physiotherapist will discuss what is realistic for you after an assessment. This information is general and is not a substitute for individual medical advice. Images are illustrative and do not show clinic staff or patients.
                      </p>

                      <div className="sticky bottom-0 -mx-6 mt-8 flex flex-col gap-3 border-t border-line bg-ivory/95 px-6 py-4 backdrop-blur sm:-mx-10 sm:flex-row sm:px-10">
                        <Link href={`/book?type=clinic&reason=${encodeURIComponent(service.title)}`} className={buttonClass("primary", "md", "flex-1")} onClick={onClose}>
                          <CalendarCheck className="h-4 w-4" aria-hidden /> Book an Appointment
                        </Link>
                        <Link href={`/book?type=home&reason=${encodeURIComponent(service.title)}`} className={buttonClass("secondary", "md", "flex-1")} onClick={onClose}>
                          <Home className="h-4 w-4" aria-hidden /> Request a Home Visit
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-sans text-sm font-semibold text-navy-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-[15px] text-muted">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" aria-hidden />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
