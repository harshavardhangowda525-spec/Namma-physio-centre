"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Armchair, Dumbbell, HeartPulse, Sofa, Users, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Media } from "./media";
import { staggerItem, Stagger } from "./motion";

/** `src` images are illustrative (AI-generated) until the clinic supplies real photographs. */
export type GalleryItem = { src: string | null; alt: string; caption: string; icon: LucideIcon };

export const defaultGallery: GalleryItem[] = [
  { src: "/images/site/gallery-reception.jpg", alt: "A calm, modern clinic reception and waiting area", caption: "Reception", icon: Sofa },
  { src: "/images/site/gallery-treatment-room.jpg", alt: "A private treatment room with a padded treatment table", caption: "Treatment room", icon: Armchair },
  { src: "/images/site/gallery-equipment.jpg", alt: "Rehabilitation equipment: resistance bands, dumbbells, foam roller and balance board", caption: "Physiotherapy equipment", icon: Dumbbell },
  { src: "/images/site/gallery-session.jpg", alt: "A patient doing a step-up exercise during a rehabilitation session", caption: "Rehabilitation session", icon: HeartPulse },
  { src: null, alt: "Doctor and team", caption: "Doctor and team", icon: Users },
];

export function Gallery({ items = defaultGallery }: { items?: GalleryItem[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  const n = items.length;
  const step = useCallback((d: number) => setIdx((i) => (i === null ? i : (i + d + n) % n)), [n]);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, step]);

  const spans = ["md:col-span-2 md:row-span-2", "", "", "", ""];

  return (
    <>
      <Stagger className="grid auto-rows-[180px] grid-cols-2 gap-4 md:auto-rows-[200px] md:grid-cols-4">
        {items.map((it, i) => (
          <motion.button
            key={it.caption}
            variants={staggerItem}
            type="button"
            onClick={() => setIdx(i)}
            className={`group relative overflow-hidden rounded-3xl ${spans[i % spans.length]} ${i === 0 ? "col-span-2" : ""}`}
            aria-label={`Open photo: ${it.caption}`}
          >
            <div className="h-full w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-105">
              <Media src={it.src} alt={it.alt} icon={it.icon} variant={i} className="h-full w-full" showBadge={false} sizes="(min-width:768px) 50vw, 100vw" />
            </div>
            <span className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/85 px-3 py-2 text-left text-sm font-semibold text-navy-900 backdrop-blur transition group-hover:bg-white">
              {it.caption}
              <span className="block text-[11px] font-normal text-muted">{it.src ? "Illustrative image" : "Photo to be supplied by the clinic"}</span>
            </span>
          </motion.button>
        ))}
      </Stagger>

      <Dialog.Root open={idx !== null} onOpenChange={(o) => !o && setIdx(null)}>
        <AnimatePresence>
          {idx !== null && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div className="fixed inset-0 z-[60] bg-navy-950/85 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div className="fixed inset-0 z-[61] grid place-items-center p-4 outline-none" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                  <Dialog.Title className="sr-only">{items[idx].caption}</Dialog.Title>
                  <div className="relative w-full max-w-5xl">
                    <AnimatePresence mode="wait">
                      <motion.div key={idx} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35 }}>
                        <Media src={items[idx].src} alt={items[idx].alt} icon={items[idx].icon} variant={idx} className="aspect-[16/10] w-full rounded-3xl" sizes="100vw" />
                        <p className="mt-4 text-center text-white">{items[idx].caption} <span className="text-white/50">· {items[idx].src ? "Illustrative image · " : ""}{idx + 1} / {n}</span></p>
                      </motion.div>
                    </AnimatePresence>
                    <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute top-1/2 left-2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900"><ArrowLeft className="h-5 w-5" /></button>
                    <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute top-1/2 right-2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy-900"><ArrowRight className="h-5 w-5" /></button>
                  </div>
                  <Dialog.Close aria-label="Close gallery" className="fixed top-5 right-5 grid h-12 w-12 place-items-center rounded-full bg-white text-navy-900"><X className="h-5 w-5" /></Dialog.Close>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
