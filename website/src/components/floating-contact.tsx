"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Phone } from "lucide-react";
import { clinic, whatsappChatUrl } from "@/content/clinic";

function WhatsAppIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.13-.96-.31-1.66-.61-2.92-1.26-4.83-4.21-4.97-4.4-.15-.2-1.19-1.58-1.19-3.01 0-1.43.75-2.14 1.02-2.43.27-.29.59-.36.79-.36.2 0 .4.01.57.01.18.01.43-.07.67.51.24.59.83 2.03.9 2.18.07.15.12.32.02.52-.1.2-.15.32-.29.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.35 1.45.29.15.46.12.63-.07.17-.2.73-.85.93-1.14.2-.29.39-.24.66-.15.27.1 1.71.81 2 .95.29.15.49.22.56.34.07.12.07.7-.17 1.38z" />
    </svg>
  );
}

export function FloatingContactButtons() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  // Hide on admin & standalone doctor approval routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/appointments/")) {
    return null;
  }

  return (
    <div
      aria-label="Quick clinic contact options"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6"
    >
      {/* Direct Calling Button */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="group relative flex items-center"
      >
        <span
          role="tooltip"
          className="pointer-events-none mr-3 hidden rounded-full border border-line bg-navy-900 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-[var(--shadow-soft)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:block"
        >
          Call Namma Physiotherapy Centre
        </span>
        <a
          href={`tel:${clinic.phoneE164}`}
          aria-label={`Call Namma Physiotherapy Centre (${clinic.phoneDisplay})`}
          title={`Call Namma Physiotherapy Centre (${clinic.phoneDisplay})`}
          className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-navy-900 text-white shadow-[var(--shadow-lift)] transition-transform duration-300 hover:scale-105 hover:bg-navy-800 focus-visible:ring-4 focus-visible:ring-teal-300 active:scale-95 sm:h-13 sm:w-13"
        >
          <Phone className="h-5 w-5" aria-hidden />
        </a>
      </motion.div>

      {/* WhatsApp Click-to-Chat Button */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.85, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="group relative flex items-center"
      >
        <span
          role="tooltip"
          className="pointer-events-none mr-3 hidden rounded-full border border-emerald-700/20 bg-navy-900 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-[var(--shadow-soft)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:block"
        >
          Chat on WhatsApp
        </span>
        <a
          href={whatsappChatUrl()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with Namma Physiotherapy Centre on WhatsApp"
          title="Chat with Namma Physiotherapy Centre on WhatsApp"
          className="grid h-13 w-13 place-items-center rounded-full bg-[#1fa855] text-white shadow-[0_10px_28px_-6px_rgba(31,168,85,0.55)] ring-2 ring-white/90 transition-transform duration-300 hover:scale-105 hover:bg-[#199249] focus-visible:ring-4 focus-visible:ring-emerald-300 active:scale-95 sm:h-14 sm:w-14"
        >
          <WhatsAppIcon className="h-6 w-6 sm:h-7 sm:w-7" />
        </a>
      </motion.div>
    </div>
  );
}
