"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Building2, Check, CheckCircle2, Copy, Home, Loader2, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { bookingConfig } from "@/content/booking";
import { clinic } from "@/content/clinic";
import { addDays, bookingSchema, todayIST } from "@/lib/booking-schema";
import { Media } from "./media";
import { buttonClass } from "./ui";

type VisitType = "clinic" | "home";
type Errors = Partial<Record<string, string>>;

const EASE = [0.16, 1, 0.3, 1] as const;

const options: { type: VisitType; title: string; body: string; icon: typeof Home; label: string; image: string; alt: string }[] = [
  { type: "clinic", title: "Clinic Visit", body: "Visit Namma Physio Centre at our JP Nagar 8th Phase location.", icon: Building2, label: "Placeholder · clinic photo", image: "/images/site/book-clinic.jpg", alt: "A bright physiotherapy treatment area with treatment tables and exercise equipment" },
  { type: "home", title: "Home Visit", body: "Request a physiotherapist to visit you at home. Coverage area and charges are confirmed by the clinic.", icon: Home, label: "Placeholder · home visit photo", image: "/images/site/book-home.jpg", alt: "A physiotherapist arriving at a patient's home for a visit" },
];

export function BookingFlow() {
  const params = useSearchParams();
  const initialType = params.get("type");
  const [type, setType] = useState<VisitType | null>(initialType === "clinic" || initialType === "home" ? initialType : null);
  const [done, setDone] = useState<{ reference: string; type: VisitType } | null>(null);
  const formTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (type && !done) formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [type, done]);

  if (done) return <Success reference={done.reference} type={done.type} />;

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Choose appointment type</legend>
        <div className="grid gap-6 md:grid-cols-2">
          {options.map((o, i) => {
            const selected = type === o.type;
            return (
              <motion.label
                key={o.type}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`group relative block cursor-pointer overflow-hidden rounded-[2rem] border-2 bg-white transition-[border-color,box-shadow] duration-500 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-200 ${
                  selected ? "border-teal-500 shadow-[var(--shadow-glow)]" : "border-line shadow-[var(--shadow-soft)] hover:border-teal-200"
                }`}
              >
                <input type="radio" name="visitType" value={o.type} checked={selected} onChange={() => setType(o.type)} className="sr-only" />
                <div className="relative aspect-[16/8] overflow-hidden">
                  <motion.div className="h-full w-full" animate={{ scale: selected ? 1.05 : 1 }} transition={{ duration: 1.2, ease: EASE }}>
                    <Media src={o.image} alt={o.alt} icon={o.icon} variant={i + 1} className="h-full w-full" label={o.label} sizes="(min-width: 768px) 50vw, 100vw" />
                  </motion.div>
                </div>
                <div className="flex items-start gap-4 p-6 sm:p-7">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors duration-500 ${selected ? "bg-teal-500 text-white" : "bg-teal-50 text-teal-600"}`}>
                    <o.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <span className="block font-display text-2xl text-navy-900">{o.title}</span>
                    <span className="mt-1 block text-[15px] text-muted">{o.body}</span>
                  </div>
                  <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-300 ${selected ? "border-teal-500 bg-teal-500 text-white" : "border-line"}`}>
                    <AnimatePresence>{selected && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-4 w-4" strokeWidth={3} /></motion.span>}</AnimatePresence>
                  </span>
                </div>
              </motion.label>
            );
          })}
        </div>
      </fieldset>

      <div ref={formTop} className="scroll-mt-28" />
      <AnimatePresence mode="wait">
        {type && (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 40, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mt-12"
          >
            <BookingForm type={type} initialReason={params.get("reason") ?? ""} onDone={(reference) => setDone({ reference, type })} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingForm({ type, initialReason, onDone }: { type: VisitType; initialReason: string; onDone: (ref: string) => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({ reason: initialReason.slice(0, 200), consent: false });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: string, v: string | boolean) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const payload = { ...values, visitType: type };
    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      const next: Errors = {};
      for (const k in fe) next[k] = fe[k]?.[0];
      setErrors(next);
      const first = Object.keys(next)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.fields) {
          const next: Errors = {};
          for (const k in j.fields) next[k] = j.fields[k]?.[0];
          setErrors(next);
        }
        setServerError(j.error ?? "Something went wrong. Please try again or call the clinic.");
        return;
      }
      onDone(j.reference);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setServerError("We couldn't reach the server. Please check your connection or call the clinic.");
    } finally {
      setSubmitting(false);
    }
  }

  const today = todayIST();
  const v = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : "");

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="card relative overflow-hidden p-6 sm:p-10">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-100/50 blur-3xl" />
      <div className="relative">
        <p className="eyebrow">{type === "home" ? "Home visit request" : "Clinic visit request"}</p>
        <h2 className="mt-4 text-3xl">Your details</h2>
        <p className="mt-2 text-sm text-muted">Fields marked <span className="text-rose-600">*</span> are required. Your selected date and time are a preference — the clinic will call to confirm.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Field name="patientName" label="Patient name" required error={errors.patientName}>
            {(p) => <input {...p} autoComplete="name" value={v("patientName")} onChange={(e) => set("patientName", e.target.value)} className="field" />}
          </Field>
          <Field name="mobile" label="Mobile number" required error={errors.mobile} hint="10-digit Indian mobile number">
            {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={v("mobile")} onChange={(e) => set("mobile", e.target.value)} className="field" />}
          </Field>
          <Field name="email" label="Email (optional)" error={errors.email} className="sm:col-span-2">
            {(p) => <input {...p} type="email" autoComplete="email" value={v("email")} onChange={(e) => set("email", e.target.value)} className="field" />}
          </Field>

          {type === "home" && (
            <>
              <Field name="address" label="Complete home address" required error={errors.address} className="sm:col-span-2">
                {(p) => <textarea {...p} rows={3} autoComplete="street-address" value={v("address")} onChange={(e) => set("address", e.target.value)} className="field resize-y" placeholder="House / flat number, building, street, landmark" />}
              </Field>
              <Field name="locality" label="Area / locality" required error={errors.locality}>
                {(p) => <input {...p} autoComplete="address-level3" value={v("locality")} onChange={(e) => set("locality", e.target.value)} className="field" placeholder="e.g. JP Nagar 8th Phase" />}
              </Field>
              <Field name="pinCode" label="PIN code" required error={errors.pinCode}>
                {(p) => <input {...p} inputMode="numeric" autoComplete="postal-code" maxLength={6} value={v("pinCode")} onChange={(e) => set("pinCode", e.target.value.replace(/\D/g, ""))} className="field" placeholder="560083" />}
              </Field>
            </>
          )}

          <Field name="preferredDate" label="Preferred date" required error={errors.preferredDate}>
            {(p) => <input {...p} type="date" min={today} max={addDays(today, bookingConfig.maxDaysAhead)} value={v("preferredDate")} onChange={(e) => set("preferredDate", e.target.value)} className="field" />}
          </Field>
          <Field name="preferredTime" label="Preferred time" required error={errors.preferredTime}>
            {(p) => (
              <select {...p} value={v("preferredTime")} onChange={(e) => set("preferredTime", e.target.value)} className="field">
                <option value="">Select a time</option>
                {bookingConfig.preferredTimes.map((t) => <option key={t}>{t}</option>)}
              </select>
            )}
          </Field>
          <Field name="reason" label="Reason for visit (optional)" error={errors.reason} className="sm:col-span-2">
            {(p) => <input {...p} maxLength={200} value={v("reason")} onChange={(e) => set("reason", e.target.value)} className="field" placeholder="e.g. knee pain after a sports injury" />}
          </Field>
          <Field name="notes" label="Additional notes (optional)" error={errors.notes} className="sm:col-span-2">
            {(p) => <textarea {...p} rows={3} maxLength={1000} value={v("notes")} onChange={(e) => set("notes", e.target.value)} className="field resize-y" />}
          </Field>

          {/* Honeypot — hidden from people, visible to bots */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Company<input tabIndex={-1} autoComplete="off" name="company" value={v("company")} onChange={(e) => set("company", e.target.value)} /></label>
          </div>
        </div>

        <div className="mt-6">
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${errors.consent ? "border-rose-300 bg-rose-50/50" : "border-line bg-cream/50"}`}>
            <input type="checkbox" name="consent" checked={values.consent === true} onChange={(e) => set("consent", e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "consent-err" : undefined} className="mt-1 h-5 w-5 shrink-0 accent-teal-600" />
            <span className="text-sm text-ink/85">
              I consent to {clinic.name} storing these details and contacting me by phone{values.email ? " or email" : ""} about this appointment request, as described in the <Link href="/privacy" className="font-semibold text-teal-700 underline-offset-2 hover:underline" target="_blank">Privacy Policy</Link>. <span className="text-rose-600">*</span>
            </span>
          </label>
          {errors.consent && <p id="consent-err" className="mt-2 text-sm text-rose-600">{errors.consent}</p>}
        </div>

        <AnimatePresence>
          {serverError && (
            <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
              {serverError} <a href={`tel:${clinic.phoneE164}`} className="font-semibold underline">{clinic.phoneDisplay}</a>
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-8 flex flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden /> Your details are sent securely and seen only by clinic staff.</p>
          <button type="submit" disabled={submitting} className={buttonClass("primary", "lg")}>
            {submitting ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Sending request…</> : "Request Appointment"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  name, label, required, error, hint, className = "", children,
}: {
  name: string; label: string; required?: boolean; error?: string; hint?: string; className?: string;
  children: (p: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string; "aria-required"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">{label}{required && <span className="text-rose-600"> *</span>}</label>
      {children({ id, name, "aria-invalid": !!error, "aria-describedby": desc, "aria-required": required || undefined })}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p key="e" id={`${id}-err`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 text-sm text-rose-600">{error}</motion.p>
        ) : hint ? (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Success({ reference, type }: { reference: string; type: VisitType }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: EASE }} className="card mx-auto max-w-2xl p-8 text-center sm:p-14" role="status" aria-live="polite">
      <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.2 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-teal-500 text-white shadow-[var(--shadow-glow)]">
        <CheckCircle2 className="h-10 w-10" aria-hidden />
      </motion.span>
      <h2 className="mt-8 text-3xl sm:text-4xl">Request received</h2>
      <p className="lead mt-4">
        Thank you. Your {type === "home" ? "home visit" : "clinic visit"} request has been sent. <strong className="text-navy-900">This is not yet a confirmed appointment</strong> — the clinic will call you to confirm a date and time.
      </p>
      <div className="mx-auto mt-8 flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-cream p-4">
        <div className="text-left">
          <p className="text-xs text-muted">Reference number</p>
          <p className="font-mono text-lg font-semibold tracking-wider text-navy-900">{reference}</p>
        </div>
        <button type="button" onClick={() => navigator.clipboard?.writeText(reference).then(() => setCopied(true))} className={buttonClass("secondary", "sm")} aria-label="Copy reference number">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className={buttonClass("secondary")}><ArrowLeft className="h-4 w-4" aria-hidden /> Back to home</Link>
        <a href={`tel:${clinic.phoneE164}`} className={buttonClass("primary")}><Phone className="h-4 w-4" aria-hidden /> Call {clinic.phoneDisplay}</a>
      </div>
    </motion.div>
  );
}
