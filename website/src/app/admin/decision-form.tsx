"use client";
import { useActionState, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { decide } from "./actions";
import type { AppointmentRequest } from "@/lib/db";
import { buttonClass } from "@/components/ui";

export function DecisionForm({ request: r }: { request: AppointmentRequest }) {
  const [state, action, pending] = useActionState(decide, undefined);
  const [date, setDate] = useState(r.confirmed_date ?? r.preferred_date);
  const [time, setTime] = useState(r.confirmed_time ?? "10:00");
  const decision = useRef<HTMLInputElement>(null);
  const choose = (v: string) => () => { if (decision.current) decision.current.value = v; };
  const booked = r.status === "confirmed" || r.status === "rescheduled";
  const closed = r.status === "rejected" || r.status === "cancelled";

  const waText = booked
    ? `Hello ${r.patient_name}, your appointment at Namma Physio Centre is confirmed for ${r.confirmed_date} at ${r.confirmed_time}. Ref ${r.reference}.`
    : `Hello ${r.patient_name}, this is Namma Physio Centre regarding your appointment request ${r.reference}.`;

  return (
    <form action={action} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
      <input type="hidden" name="id" value={r.id} />
      <input type="hidden" name="decision" ref={decision} defaultValue="" />
      {!closed && (
        <>
          <div>
            <label className="field-label text-xs" htmlFor={`d${r.id}`}>Date</label>
            <input id={`d${r.id}`} name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field py-2" />
          </div>
          <div>
            <label className="field-label text-xs" htmlFor={`t${r.id}`}>Time</label>
            <input id={`t${r.id}`} name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field py-2" />
          </div>
          <div className="min-w-48 flex-1">
            <label className="field-label text-xs" htmlFor={`m${r.id}`}>Internal note (optional)</label>
            <input id={`m${r.id}`} name="message" className="field py-2" maxLength={500} />
          </div>
          <button type="submit" onClick={choose(booked ? "reschedule" : "confirm")} disabled={pending} className={buttonClass("primary", "sm")}>
            {booked ? "Reschedule" : "Confirm"}
          </button>
          <button type="submit" onClick={choose(booked ? "cancel" : "reject")} disabled={pending} className={buttonClass("secondary", "sm", "hover:!text-rose-700")}>
            {booked ? "Cancel" : "Reject"}
          </button>
        </>
      )}
      <a href={`https://wa.me/91${r.mobile}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
        <MessageCircle className="h-4 w-4" /> Message patient
      </a>
      {state?.error && <p role="alert" className="w-full text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p role="status" className="w-full text-sm text-teal-700">{state.ok}</p>}
    </form>
  );
}
