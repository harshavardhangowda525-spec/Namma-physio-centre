import { CalendarDays, Home, LogOut, MapPin, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { calendarConfigured, isCalendarConnected } from "@/lib/calendar";
import { listRequests, storageMode, type RequestStatus } from "@/lib/db";
import { disconnectCalendarAction, logout } from "./actions";
import { DecisionForm } from "./decision-form";
import { buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const tabs: (RequestStatus | "all")[] = ["requested", "confirmed", "rescheduled", "rejected", "cancelled", "all"];
const badge: Record<RequestStatus, string> = {
  requested: "bg-amber-100 text-amber-900",
  confirmed: "bg-teal-100 text-teal-800",
  rescheduled: "bg-cyan-soft text-navy-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled: "bg-sand text-navy-700",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string; calendar?: string; saved?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (tabs.includes(sp.status as RequestStatus) ? sp.status : "requested") as RequestStatus | "all";
  const [requests, connected] = await Promise.all([listRequests(status), isCalendarConnected()]);

  return (
    <section className="container-px">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Appointment requests</h1>
          <p className="mt-2 text-sm text-muted">
            Requests from the website are preferences only until you confirm them here.
            {storageMode === "memory" && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">Development storage (not persistent)</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {calendarConfigured() &&
            (connected ? (
              <form action={disconnectCalendarAction}>
                <button className={buttonClass("secondary", "sm")}><CalendarDays className="h-4 w-4" /> Google Calendar connected · Disconnect</button>
              </form>
            ) : (
              <a href="/api/admin/calendar/connect" className={buttonClass("secondary", "sm")}><CalendarDays className="h-4 w-4" /> Connect Google Calendar</a>
            ))}
          <form action={logout}>
            <button className={buttonClass("ghost", "sm")}><LogOut className="h-4 w-4" /> Sign out</button>
          </form>
        </div>
      </div>
      {sp.saved && <p role="status" className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">Saved {sp.saved}. Remember to let the patient know.</p>}
      {sp.calendar === "connected" && <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">Google Calendar connected.</p>}
      {sp.calendar === "error" && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Google Calendar connection failed. Please try again.</p>}

      <nav aria-label="Filter by status" className="mt-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <a key={t} href={`/admin?status=${t}`} aria-current={t === status ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${t === status ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-line"}`}>
            {t}
          </a>
        ))}
      </nav>

      <ul className="mt-6 grid gap-4">
        {requests.length === 0 && <li className="card p-8 text-center text-muted">No {status === "all" ? "" : status} requests.</li>}
        {requests.map((r) => (
          <li key={r.id} className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badge[r.status]}`}>{r.status}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy-700 ring-1 ring-line">
                    {r.visit_type === "home" ? <><Home className="mr-1 inline h-3 w-3" />Home visit</> : "Clinic visit"}
                  </span>
                  <code className="text-xs text-muted">{r.reference}</code>
                </div>
                <h2 className="mt-3 font-sans text-xl font-semibold">{r.patient_name}</h2>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <a className="inline-flex items-center gap-1 text-teal-700" href={`tel:+91${r.mobile}`}><Phone className="h-3.5 w-3.5" />+91 {r.mobile}</a>
                  {r.email && <span>{r.email}</span>}
                  <span>Received {new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted">Preferred</p>
                <p className="font-semibold text-navy-900">{r.preferred_date}</p>
                <p className="text-muted">{r.preferred_time}</p>
                {r.confirmed_date && <p className="mt-2 font-semibold text-teal-700">Booked: {r.confirmed_date} {r.confirmed_time}</p>}
              </div>
            </div>
            {r.visit_type === "home" && (
              <p className="mt-3 flex gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />{r.address}, {r.locality} – {r.pin_code}</p>
            )}
            {(r.reason || r.notes) && (
              <div className="mt-3 rounded-xl bg-cream p-3 text-sm">
                {r.reason && <p><b>Reason:</b> {r.reason}</p>}
                {r.notes && <p className="mt-1 whitespace-pre-wrap"><b>Notes:</b> {r.notes}</p>}
              </div>
            )}
            <DecisionForm request={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
