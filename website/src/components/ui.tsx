import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "light";

const base =
  "group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 ease-[var(--ease-out-expo)] focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-60 select-none";
const sizes = { md: "h-12 px-6 text-[15px]", lg: "h-14 px-8 text-base", sm: "h-10 px-4 text-sm" };
const variants: Record<Variant, string> = {
  primary:
    "bg-navy-900 text-white shadow-[var(--shadow-lift)] hover:bg-navy-800 hover:shadow-[var(--shadow-glow)] active:scale-[0.98]",
  secondary:
    "bg-white text-navy-900 border border-line shadow-[var(--shadow-soft)] hover:border-teal-300 hover:text-teal-700 active:scale-[0.98]",
  ghost: "text-navy-900 hover:bg-teal-50 hover:text-teal-700",
  light: "bg-white text-navy-900 shadow-[var(--shadow-lift)] hover:bg-teal-50 active:scale-[0.98]",
};

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; size?: keyof typeof sizes; className?: string; children: ReactNode } & Omit<
  ComponentProps<typeof Link>,
  "href" | "className"
>) {
  const external = /^(https?:|tel:|mailto:)/.test(href);
  if (external) {
    return (
      <a
        href={href}
        className={buttonClass(variant, size, className)}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={`${align === "center" ? "mx-auto text-center" : ""} max-w-3xl ${className}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="section-title mt-5">{title}</h2>
      {lead && <p className="lead mt-5">{lead}</p>}
    </div>
  );
}

export function Stars({ rating, size = 16, className = "" }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${rating} out of 5 stars`} role="img">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
            <defs>
              <linearGradient id={`s${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#f5b301" />
                <stop offset={`${fill * 100}%`} stopColor="#e5e1d8" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#s${i}-${Math.round(fill * 100)})`}
              d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z"
            />
          </svg>
        );
      })}
    </span>
  );
}

export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Namma Physiotherapy Centre brand lockup. The "Caring Circle" mark was
 * approved by the clinic (Nov 2026). `light` renders the white mark for dark
 * backgrounds. Source files live in public/brand/.
 */
export function Logo({
  className = "",
  light = false,
  prominent = false,
}: {
  className?: string;
  light?: boolean;
  prominent?: boolean;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        src={light ? "/brand/logo-mark-white.png" : "/brand/logo-mark.png"}
        alt=""
        aria-hidden
        width={prominent ? 52 : 44}
        height={prominent ? 52 : 44}
        priority={prominent}
        className={`shrink-0 object-contain ${prominent ? "h-9 w-9 sm:h-[52px] sm:w-[52px]" : "h-11 w-11"}`}
      />
      <span className="min-w-0 leading-tight">
        <span
          className={`block font-display font-semibold tracking-tight ${
            prominent
              ? "text-[17px] leading-[1.12] sm:text-[23px] lg:text-[28px] xl:text-[30px]"
              : "text-[19px]"
          } ${light ? "text-white" : "text-navy-900"}`}
        >
          Namma Physiotherapy Centre
        </span>
        <span
          className={`mt-0.5 block font-semibold tracking-[0.18em] uppercase ${
            prominent ? "text-[10px] sm:text-[11px]" : "text-[10.5px]"
          } ${light ? "text-teal-200" : "text-teal-700"}`}
        >
          JP Nagar 8th Phase · Bengaluru
        </span>
      </span>
    </span>
  );
}
