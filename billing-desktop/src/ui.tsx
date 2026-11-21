import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { formatINR, rupeesToPaise } from "../shared/billing";

export const money = (p: number | null | undefined) => formatINR(p ?? 0);
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(+d) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
export const fmtDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
  secondary: "bg-white text-navy-900 border border-line hover:border-teal-400 hover:text-teal-700",
  ghost: "text-navy-800 hover:bg-teal-50 hover:text-teal-700",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};
export function Button({ variant = "primary", size = "md", loading, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none ${size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-5 text-sm"} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint, error, className = "" }: { label: string; children: ReactNode; hint?: string; error?: string | null; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

/** Rupee input that stores paise. */
export function MoneyInput({ value, onChange, className = "", ...rest }: { value: number; onChange: (paise: number) => void; className?: string; placeholder?: string; "aria-label"?: string; disabled?: boolean }) {
  const [text, setText] = useState(value ? (value / 100).toFixed(2) : "");
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value ? (value / 100).toFixed(2) : "");
      last.current = value;
    }
  }, [value]);
  const bad = text !== "" && rupeesToPaise(text) === null;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">₹</span>
      <input
        {...rest}
        inputMode="decimal"
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value);
          const p = rupeesToPaise(e.target.value || "0");
          if (p !== null) {
            last.current = p;
            onChange(p);
          }
        }}
        className={`input num pl-7 text-right ${bad ? "!border-rose-400" : ""} ${className}`}
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-teal-100 text-teal-800",
    partial: "bg-amber-100 text-amber-900",
    unpaid: "bg-rose-100 text-rose-800",
    void: "bg-slate-200 text-slate-600 line-through",
    requested: "bg-amber-100 text-amber-900",
    confirmed: "bg-teal-100 text-teal-800",
    completed: "bg-navy-900/10 text-navy-800",
    cancelled: "bg-slate-200 text-slate-600",
    no_show: "bg-rose-100 text-rose-800",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-cream text-navy-800"}`}>{status.replace("_", "-")}</span>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-medium">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-600">{icon}</div>}
      <p className="font-semibold text-navy-900">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`card max-h-[90vh] w-full overflow-y-auto p-6 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-cream"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>;
}

// ---------- toasts ----------
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print fixed right-5 bottom-5 z-[60] grid gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.kind === "ok" ? "bg-navy-900" : "bg-rose-600"}`}>
            {t.kind === "ok" ? <CheckCircle2 className="h-4 w-4 text-teal-200" /> : <AlertTriangle className="h-4 w-4" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Small data-loading hook with refresh. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
        <rect width="40" height="40" rx="11" fill={light ? "#fff" : "#0b1f3a"} />
        <path d="M11 27c3-9 6-14 9-14s5 5 9 14" stroke="#3fb5aa" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <circle cx="20" cy="10.5" r="2.6" fill="#5cc8e0" />
      </svg>
      <span className="leading-none">
        <span className={`block font-display text-[17px] font-semibold ${light ? "text-white" : "text-navy-900"}`}>Namma Physio</span>
        <span className={`mt-0.5 block text-[10px] font-semibold tracking-[0.2em] uppercase ${light ? "text-teal-200" : "text-teal-600"}`}>Billing</span>
      </span>
    </span>
  );
}
