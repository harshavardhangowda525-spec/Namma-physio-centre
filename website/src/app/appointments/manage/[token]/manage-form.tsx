"use client";

import { useActionState, useState } from "react";
import { CalendarCheck, CalendarClock, CheckCircle2, Loader2, MessageCircle, XCircle } from "lucide-react";
import { submitDoctorDecision } from "./actions";
import { buttonClass } from "@/components/ui";
import type { AppointmentRequest } from "@/lib/db";

type Intent = "confirm" | "reschedule" | "decline" | "calendar";

export function DoctorManageForm({
  token,
  appointment: r,
  defaultTime,
  initialIntent,
}: {
  token: string;
  appointment: AppointmentRequest;
  defaultTime: string;
  initialIntent: Intent;
}) {
  const [state, action, pending] = useActionState(submitDoctorDecision, undefined);
  const [mode, setMode] = useState<"confirm" | "reschedule" | "decline">(
    initialIntent === "reschedule"
      ? "reschedule"
      : initialIntent === "decline"
        ? "decline"
        : "confirm",
  );
  const [date, setDate] = useState(r.confirmed_date ?? r.proposed_date ?? r.preferred_date);
  const [time, setTime] = useState(r.confirmed_time ?? r.proposed_time ?? defaultTime);
  const [duration, setDuration] = useState(String(r.duration_minutes || 45));
  const [message, setMessage] = useState("");

  const waUrl = `https://wa.me/91${r.mobile}?text=${encodeURIComponent(
    r.status === "confirmed"
      ? `Hello ${r.patient_name}, your physiotherapy appointment at Namma Physiotherapy Centre (${r.reference}) is confirmed for ${r.confirmed_date} at ${r.confirmed_time}.`
      : `Hello ${r.patient_name}, this is Namma Physiotherapy Centre regarding your appointment request (${r.reference}).`,
  )}`;

  return (
    <div className="space-y-5">
      {state?.ok && (
        <div role="status" className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-teal-600" aria-hidden />
            {state.ok}
          </p>
          {state.emailNote && <p className="mt-1 text-xs text-teal-800">{state.emailNote}</p>}
        </div>
      )}

      {state?.error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {state.error}
        </div>
      )}

      {/* Mode Switcher Tabs (Smartphone Touch Friendly) */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-cream p-1.5" role="tablist" aria-label="Choose appointment action">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "confirm"}
          onClick={() => setMode("confirm")}
          className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
            mode === "confirm" ? "bg-teal-600 text-white shadow-xs" : "text-navy-900 hover:bg-white/60"
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "reschedule"}
          onClick={() => setMode("reschedule")}
          className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
            mode === "reschedule" ? "bg-navy-900 text-white shadow-xs" : "text-navy-900 hover:bg-white/60"
          }`}
        >
          Reschedule
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "decline"}
          onClick={() => setMode("decline")}
          className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
            mode === "decline" ? "bg-rose-600 text-white shadow-xs" : "text-navy-900 hover:bg-white/60"
          }`}
        >
          Decline
        </button>
      </div>

      <form action={action} className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="actionType" value={mode} />

        {mode !== "decline" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="doc-date" className="field-label">
                  {mode === "confirm" ? "Confirmed Date" : "Proposed Date"}
                </label>
                <input
                  id="doc-date"
                  name="date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="doc-time" className="field-label">
                  {mode === "confirm" ? "Confirmed Time (IST)" : "Proposed Time (IST)"}
                </label>
                <input
                  id="doc-time"
                  name="time"
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="doc-dur" className="field-label">
                  Slot Duration
                </label>
                <select
                  id="doc-dur"
                  name="durationMinutes"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="field"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="doc-msg" className="field-label">
                {mode === "confirm" ? "Optional note (internal / record)" : "Note to patient (optional)"}
              </label>
              <input
                id="doc-msg"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={400}
                placeholder={
                  mode === "reschedule"
                    ? "e.g. Morning slots are booked; 4:30 PM is available."
                    : "Optional note"
                }
                className="field"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className={buttonClass("primary", "lg", `w-full ${mode === "confirm" ? "!bg-teal-600 hover:!bg-teal-700" : ""}`)}
            >
              {pending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Processing…
                </>
              ) : mode === "confirm" ? (
                <>
                  <CalendarCheck className="h-5 w-5" aria-hidden /> Confirm Appointment &amp; Notify Patient
                </>
              ) : (
                <>
                  <CalendarClock className="h-5 w-5" aria-hidden /> Propose Alternative Schedule
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="decline-reason" className="field-label">
                Optional polite note for patient
              </label>
              <textarea
                id="decline-reason"
                name="message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={400}
                placeholder="e.g. Our schedule is full on the requested day; please call to arrange another date."
                className="field"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className={buttonClass("primary", "lg", "w-full !bg-rose-600 hover:!bg-rose-700")}
            >
              {pending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Updating…
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5" aria-hidden /> Decline Request &amp; Notify Patient
                </>
              )}
            </button>
          </>
        )}
      </form>

      {/* Post-appointment quick status actions when already confirmed */}
      {r.status === "confirmed" && (
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="actionType" value="complete" />
            <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
              Mark Session Completed
            </button>
          </form>
          <form action={action}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="actionType" value="cancel" />
            <button type="submit" disabled={pending} className={buttonClass("ghost", "sm", "text-rose-700")}>
              Cancel Confirmed Appointment
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
        <span>Opening this page never auto-approves an appointment.</span>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:underline"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> Optional WhatsApp chat
        </a>
      </div>
    </div>
  );
}
