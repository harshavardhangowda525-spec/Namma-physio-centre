"use client";

import { useActionState, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { inferDefaultTimeSlot } from "@/lib/appointment-workflow-client";
import type { AppointmentRequest } from "@/lib/db";
import { buttonClass } from "@/components/ui";
import { decide } from "./actions";

export function DecisionForm({ request: r }: { request: AppointmentRequest }) {
  const [state, action, pending] = useActionState(decide, undefined);
  const [date, setDate] = useState(r.confirmed_date ?? r.proposed_date ?? r.preferred_date);
  const [time, setTime] = useState(r.confirmed_time ?? r.proposed_time ?? inferDefaultTimeSlot(r.preferred_time));
  const [duration, setDuration] = useState(String(r.duration_minutes || 45));
  const decision = useRef<HTMLInputElement>(null);
  const choose = (v: string) => () => {
    if (decision.current) decision.current.value = v;
  };

  const confirmed = r.status === "confirmed";
  const closed = r.status === "rejected" || r.status === "declined" || r.status === "cancelled" || r.status === "completed";

  const waText = confirmed
    ? `Hello ${r.patient_name}, your appointment at Namma Physiotherapy Centre is confirmed for ${r.confirmed_date} at ${r.confirmed_time}. Ref ${r.reference}.`
    : `Hello ${r.patient_name}, this is Namma Physiotherapy Centre regarding your appointment request ${r.reference}.`;

  return (
    <form action={action} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="decision" ref={decision} defaultValue="" />
      {!closed && (
        <>
          <div>
            <label className="field-label text-xs" htmlFor={`d${r.id}`}>
              Date
            </label>
            <input
              id={`d${r.id}`}
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field py-2"
            />
          </div>
          <div>
            <label className="field-label text-xs" htmlFor={`t${r.id}`}>
              Time (IST)
            </label>
            <input
              id={`t${r.id}`}
              name="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="field py-2"
            />
          </div>
          <div>
            <label className="field-label text-xs" htmlFor={`dur${r.id}`}>
              Duration
            </label>
            <select
              id={`dur${r.id}`}
              name="durationMinutes"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="field py-2"
            >
              <option value="30">30m</option>
              <option value="45">45m</option>
              <option value="60">60m</option>
            </select>
          </div>
          <div className="min-w-44 flex-1">
            <label className="field-label text-xs" htmlFor={`m${r.id}`}>
              Note (optional)
            </label>
            <input id={`m${r.id}`} name="message" className="field py-2" maxLength={500} />
          </div>
          {!confirmed && (
            <button type="submit" onClick={choose("confirm")} disabled={pending} className={buttonClass("primary", "sm")}>
              Approve &amp; Confirm
            </button>
          )}
          <button type="submit" onClick={choose("reschedule")} disabled={pending} className={buttonClass("secondary", "sm")}>
            Propose Reschedule
          </button>
          {confirmed && (
            <button type="submit" onClick={choose("complete")} disabled={pending} className={buttonClass("secondary", "sm")}>
              Mark Completed
            </button>
          )}
          <button
            type="submit"
            onClick={choose(confirmed ? "cancel" : "reject")}
            disabled={pending}
            className={buttonClass("secondary", "sm", "hover:!text-rose-700")}
          >
            {confirmed ? "Cancel" : "Decline"}
          </button>
        </>
      )}
      <a
        href={`https://wa.me/91${r.mobile}?text=${encodeURIComponent(waText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("ghost", "sm")}
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp patient
      </a>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-rose-600">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="w-full text-sm text-teal-700">
          {state.ok}
        </p>
      )}
    </form>
  );
}
