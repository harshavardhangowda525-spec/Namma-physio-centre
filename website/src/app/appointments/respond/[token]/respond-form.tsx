"use client";

import { useActionState, useState } from "react";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { bookingConfig } from "@/content/booking";
import { todayIST } from "@/lib/booking-schema";
import { buttonClass } from "@/components/ui";
import { submitPatientRescheduleResponse } from "./actions";

export function PatientRespondForm({
  token,
  proposedDate,
  proposedTime,
}: {
  token: string;
  proposedDate: string;
  proposedTime: string;
}) {
  const [state, action, pending] = useActionState(submitPatientRescheduleResponse, undefined);
  const [showAlt, setShowAlt] = useState(false);
  const [altDate, setAltDate] = useState(proposedDate);
  const [altTime, setAltTime] = useState(bookingConfig.preferredTimes[0]);

  if (state?.ok) {
    return (
      <div role="status" className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center text-teal-950">
        <CheckCircle2 className="mx-auto h-10 w-10 text-teal-600" aria-hidden />
        <p className="mt-3 font-semibold">{state.ok}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state?.error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3.5 text-sm text-rose-800">
          {state.error}
        </p>
      )}

      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="choice" value="accept" />
        <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full !bg-teal-600 hover:!bg-teal-700")}>
          {pending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Confirming…
            </>
          ) : (
            <>
              <CalendarCheck className="h-5 w-5" aria-hidden /> Accept {proposedDate} at {proposedTime}
            </>
          )}
        </button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowAlt((v) => !v)}
          className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline"
        >
          {showAlt ? "Hide alternative request form" : "Need a different day or time? Request another slot"}
        </button>
      </div>

      {showAlt && (
        <form action={action} className="space-y-4 rounded-2xl border border-line bg-cream/60 p-5">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="choice" value="counter" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="alt-date" className="field-label">
                Preferred Date
              </label>
              <input
                id="alt-date"
                name="preferredDate"
                type="date"
                min={todayIST()}
                required
                value={altDate}
                onChange={(e) => setAltDate(e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="alt-time" className="field-label">
                Preferred Time
              </label>
              <select
                id="alt-time"
                name="preferredTime"
                value={altTime}
                onChange={(e) => setAltTime(e.target.value)}
                className="field"
              >
                {bookingConfig.preferredTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={pending} className={buttonClass("secondary", "md", "w-full")}>
            Send Alternative Time Request
          </button>
        </form>
      )}
    </div>
  );
}
