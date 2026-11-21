import Image from "next/image";
import { ImageIcon, type LucideIcon } from "lucide-react";

const palettes = [
  ["#d5f2ee", "#e3f6fb", "#16978d"],
  ["#e3f6fb", "#f5f2ec", "#1d3c66"],
  ["#eefaf8", "#ebe6dc", "#0e7a73"],
  ["#dff0f7", "#eefaf8", "#2d5285"],
];

/**
 * Shows a real image when `src` is provided; otherwise an elegant, clearly
 * labelled placeholder. Placeholders must be replaced with authentic clinic
 * photographs before launch.
 */
export function Media({
  src,
  alt,
  label,
  icon: Icon = ImageIcon,
  variant = 0,
  className = "",
  priority = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  showBadge = true,
  badgeTop = false,
}: {
  src?: string | null;
  alt: string;
  label?: string;
  icon?: LucideIcon;
  variant?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  showBadge?: boolean;
  badgeTop?: boolean;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  const [a, b, c] = palettes[variant % palettes.length];
  return (
    <div
      role="img"
      aria-label={`${alt} (photo placeholder)`}
      className={`relative isolate overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id={`pg${variant}`} cx="70%" cy="30%" r="70%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".85" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#pg${variant})`} />
        <g fill="none" stroke={c} strokeOpacity=".16" strokeWidth="1.5">
          <circle cx="320" cy="60" r="90" />
          <circle cx="320" cy="60" r="140" />
          <circle cx="60" cy="260" r="70" />
          <path d="M-20 210 C 80 150, 160 260, 260 190 S 420 150, 440 170" />
          <path d="M-20 235 C 80 175, 160 285, 260 215 S 420 175, 440 195" />
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/70 shadow-[var(--shadow-soft)] backdrop-blur">
          <Icon className="h-9 w-9" style={{ color: c }} strokeWidth={1.5} aria-hidden />
        </div>
      </div>
      {showBadge && (
        <span className={`absolute left-3 ${badgeTop ? "top-3" : "bottom-3"} rounded-full bg-white/85 px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-navy-700 backdrop-blur`}>
          {label ?? "Placeholder · replace with clinic photo"}
        </span>
      )}
    </div>
  );
}
