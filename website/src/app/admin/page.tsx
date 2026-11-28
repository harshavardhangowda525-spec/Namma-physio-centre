import { CalendarDays, CheckCircle2, Home, LogOut, Mail, MapPin, Phone, RefreshCw, Star } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { calendarConfigured, isCalendarConnected } from "@/lib/calendar";
import {
  canonicalStatusGroup,
  getReviewsSyncMeta,
  listAppointmentAudits,
  listEmailDeliveries,
  listRequests,
  statusLabel,
  storageMode,
  type RequestStatus,
} from "@/lib/db";
import { getGmailStatus } from "@/lib/gmail";
import { gbpOAuthConfigured, isGbpConnected } from "@/lib/reviews";
import {
  disconnectCalendarAction,
  disconnectGbpReviewsAction,
  disconnectGmailAction,
  logout,
  testGmailSendAction,
  triggerGoogleReviewsSyncAction,
} from "./actions";
import { DecisionForm } from "./decision-form";
import { buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const tabs: { key: RequestStatus | "all"; label: string }[] = [
  { key: "pending_approval", label: "Pending Doctor Approval" },
  { key: "confirmed", label: "Confirmed" },
  { key: "reschedule_proposed", label: "Reschedule Proposed" },
  { key: "declined", label: "Declined" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

const badgeByGroup: Record<ReturnType<typeof canonicalStatusGroup>, string> = {
  pending_approval: "bg-amber-100 text-amber-900",
  confirmed: "bg-teal-100 text-teal-800",
  reschedule_proposed: "bg-cyan-soft text-navy-800",
  declined: "bg-rose-100 text-rose-800",
  cancelled: "bg-sand text-navy-700",
  completed: "bg-emerald-100 text-emerald-900",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    calendar?: string;
    gmail?: string;
    reviews?: string;
    detail?: string;
    saved?: string;
    count?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const activeTab = (tabs.some((t) => t.key === sp.status) ? sp.status : "pending_approval") as RequestStatus | "all";

  const [requests, calConnected, gmailStatus, gbpConnected, reviewsMeta, emailLogs, recentAudits] = await Promise.all([
    listRequests(activeTab),
    isCalendarConnected(),
    getGmailStatus(),
    isGbpConnected(),
    getReviewsSyncMeta(),
    listEmailDeliveries(15),
    listAppointmentAudits(undefined, 15),
  ]);

  return (
    <section className="container-px space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Website Appointment &amp; Integration Admin</h1>
          <p className="mt-2 text-sm text-muted">
            Manage appointment approvals, authorized clinic Gmail delivery, Google Calendar availability, and dynamic Google Reviews synchronization.
            {storageMode === "memory" && (
              <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                Development storage (not persistent)
              </span>
            )}
          </p>
        </div>
        <form action={logout}>
          <button className={buttonClass("ghost", "sm")}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>

      {/* Flash Alerts */}
      {sp.saved && (
        <p role="status" className="rounded-xl bg-teal-50 p-3.5 text-sm text-teal-900 ring-1 ring-teal-200">
          Updated appointment <strong>{sp.saved}</strong>.
        </p>
      )}
      {sp.gmail === "authorized_pending_test" && (
        <p role="status" className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200">
          Gmail OAuth token saved. Click <strong>Send Verification Test Email</strong> below to complete verification.
        </p>
      )}
      {sp.gmail === "verified" && (
        <p role="status" className="rounded-xl bg-teal-50 p-3.5 text-sm text-teal-900 ring-1 ring-teal-200">
          Clinic Gmail verified! Test email delivered to {gmailStatus.targetEmail}.
        </p>
      )}
      {(sp.gmail === "error" || sp.gmail === "test_failed") && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3.5 text-sm text-rose-800 ring-1 ring-rose-200">
          Gmail setup issue: {sp.detail || "Authorization failed. Check Google Cloud OAuth credentials and redirect URI."}
        </p>
      )}
      {sp.calendar === "connected" && (
        <p role="status" className="rounded-xl bg-teal-50 p-3.5 text-sm text-teal-900">
          Google Calendar connected.
        </p>
      )}
      {sp.reviews === "synced" && (
        <p role="status" className="rounded-xl bg-teal-50 p-3.5 text-sm text-teal-900">
          Google Reviews synchronized ({sp.count ?? 0} review records processed).
        </p>
      )}
      {sp.reviews === "sync_failed" && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900">
          Google Reviews sync note: {sp.detail}
        </p>
      )}

      {/* Integration Cards: Gmail OAuth, Google Calendar, Google Reviews */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* 1. Clinic Gmail OAuth */}
        <div className="card flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-navy-900">
                <Mail className="h-4 w-4 text-teal-600" aria-hidden /> Clinic Gmail Automation
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  gmailStatus.verified
                    ? "bg-teal-100 text-teal-800"
                    : gmailStatus.connected
                      ? "bg-amber-100 text-amber-900"
                      : "bg-sand text-navy-700"
                }`}
              >
                {gmailStatus.verified
                  ? "Connected & Verified"
                  : gmailStatus.connected
                    ? "Authorized · Test Pending"
                    : "Pending Authorization"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Target inbox: <strong>{gmailStatus.targetEmail}</strong>
              {gmailStatus.authorizedEmail && (
                <>
                  <br />
                  Authorized account: <strong>{gmailStatus.authorizedEmail}</strong>
                </>
              )}
              {gmailStatus.verifiedSendAt && (
                <>
                  <br />
                  Verified: {new Date(gmailStatus.verifiedSendAt).toLocaleDateString("en-IN")}
                </>
              )}
            </p>
            <p className="mt-2 text-[11px] text-muted">
              Gmail filter tip: Filter subject <code>New Appointment Request —</code> → label <code>Namma Physio — Appointments</code>.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            {gmailStatus.configured ? (
              <>
                <a href="/api/admin/gmail/connect" className={buttonClass("secondary", "sm")}>
                  {gmailStatus.connected ? "Reconnect Gmail" : "Authorize Gmail"}
                </a>
                {gmailStatus.connected && (
                  <>
                    <form action={testGmailSendAction}>
                      <button className={buttonClass("primary", "sm")}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Send Test Email
                      </button>
                    </form>
                    <form action={disconnectGmailAction}>
                      <button className={buttonClass("ghost", "sm", "text-rose-700")}>Disconnect</button>
                    </form>
                  </>
                )}
              </>
            ) : (
              <span className="text-xs text-amber-800">
                Set <code>GOOGLE_OAUTH_CLIENT_ID</code>, <code>GOOGLE_OAUTH_CLIENT_SECRET</code>, and <code>OAUTH_TOKEN_ENCRYPTION_KEY</code> in Vercel to enable Gmail OAuth.
              </span>
            )}
          </div>
        </div>

        {/* 2. Google Calendar */}
        <div className="card flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-navy-900">
                <CalendarDays className="h-4 w-4 text-teal-600" aria-hidden /> Google Calendar Sync
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  calConnected ? "bg-teal-100 text-teal-800" : "bg-sand text-navy-700"
                }`}
              >
                {calConnected ? "Connected" : "Optional / Not Connected"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Checks free/busy periods in <code>Asia/Kolkata</code> before approving appointments and creates privacy-safe calendar events automatically upon confirmation.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            {calendarConfigured() ? (
              calConnected ? (
                <>
                  <a href="/api/admin/calendar/connect" className={buttonClass("secondary", "sm")}>
                    Reconnect
                  </a>
                  <form action={disconnectCalendarAction}>
                    <button className={buttonClass("ghost", "sm", "text-rose-700")}>Disconnect</button>
                  </form>
                </>
              ) : (
                <a href="/api/admin/calendar/connect" className={buttonClass("secondary", "sm")}>
                  Connect Google Calendar
                </a>
              )
            ) : (
              <span className="text-xs text-muted">Requires Google OAuth env vars in Vercel.</span>
            )}
          </div>
        </div>

        {/* 3. Dynamic Google Reviews Sync */}
        <div className="card flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-navy-900">
                <Star className="h-4 w-4 text-teal-600" aria-hidden /> Google Reviews Sync
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  gbpConnected ? "bg-teal-100 text-teal-800" : "bg-sand text-navy-700"
                }`}
              >
                {gbpConnected ? "GBP OAuth Active" : reviewsMeta?.provider === "google-places" ? "Places API Active" : "Snapshot Mode"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {reviewsMeta?.last_synced_at
                ? `Last synced ${new Date(reviewsMeta.last_synced_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (${reviewsMeta.synced_reviews} reviews, status: ${reviewsMeta.last_status}).`
                : "Connect verified Google Business Profile OAuth (or Places API key) to synchronize authentic patient reviews daily (and on visits when the cache is older than 8 hours)."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            <form action={triggerGoogleReviewsSyncAction}>
              <button className={buttonClass("secondary", "sm")}>
                <RefreshCw className="h-3.5 w-3.5" /> Sync Now
              </button>
            </form>
            {gbpOAuthConfigured() &&
              (gbpConnected ? (
                <form action={disconnectGbpReviewsAction}>
                  <button className={buttonClass("ghost", "sm", "text-rose-700")}>Disconnect GBP</button>
                </form>
              ) : (
                <a href="/api/admin/google-reviews/connect" className={buttonClass("secondary", "sm")}>
                  Authorize GBP
                </a>
              ))}
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <nav aria-label="Filter appointments by status" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/admin?status=${t.key}`}
            aria-current={t.key === activeTab ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              t.key === activeTab ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-line hover:ring-teal-300"
            }`}
          >
            {t.label}
          </a>
        ))}
      </nav>

      {/* Appointment Requests List */}
      <ul className="grid gap-4">
        {requests.length === 0 && (
          <li className="card p-8 text-center text-muted">
            No appointments in {tabs.find((t) => t.key === activeTab)?.label ?? activeTab}.
          </li>
        )}
        {requests.map((r) => {
          const group = canonicalStatusGroup(r.status);
          return (
            <li key={r.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeByGroup[group]}`}>
                      {statusLabel(r.status)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy-700 ring-1 ring-line">
                      {r.visit_type === "home" ? (
                        <>
                          <Home className="mr-1 inline h-3 w-3" />
                          Home visit
                        </>
                      ) : (
                        "Clinic visit"
                      )}
                    </span>
                    <code className="text-xs text-muted">{r.reference}</code>
                  </div>
                  <h2 className="mt-3 font-sans text-xl font-semibold">{r.patient_name}</h2>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <a className="inline-flex items-center gap-1 text-teal-700" href={`tel:+91${r.mobile}`}>
                      <Phone className="h-3.5 w-3.5" />
                      +91 {r.mobile}
                    </a>
                    {r.email && <span>{r.email}</span>}
                    <span>
                      Submitted {new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </span>
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted">Requested</p>
                  <p className="font-semibold text-navy-900">{r.preferred_date}</p>
                  <p className="text-muted">{r.preferred_time}</p>
                  {r.confirmed_date && (
                    <p className="mt-2 font-semibold text-teal-700">
                      Confirmed: {r.confirmed_date} · {r.confirmed_time}
                    </p>
                  )}
                  {r.proposed_date && group === "reschedule_proposed" && (
                    <p className="mt-2 font-semibold text-navy-800">
                      Proposed: {r.proposed_date} · {r.proposed_time}
                    </p>
                  )}
                </div>
              </div>

              {r.visit_type === "home" && (
                <p className="mt-3 flex gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  {r.address}, {r.locality} – {r.pin_code}
                </p>
              )}

              {(r.requested_service || r.reason || r.notes || r.clinic_message) && (
                <div className="mt-3 rounded-xl bg-cream p-3 text-sm">
                  {(r.requested_service || r.reason) && (
                    <p>
                      <b>Service:</b> {r.requested_service || r.reason}
                    </p>
                  )}
                  {r.notes && (
                    <p className="mt-1 whitespace-pre-wrap">
                      <b>Patient notes:</b> {r.notes}
                    </p>
                  )}
                  {r.clinic_message && (
                    <p className="mt-1 text-xs text-navy-700">
                      <b>Clinic note:</b> {r.clinic_message}
                    </p>
                  )}
                </div>
              )}

              <DecisionForm request={r} />
            </li>
          );
        })}
      </ul>

      {/* Email Delivery & Approval Audit Logs */}
      <div className="grid gap-6 pt-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-sans text-sm font-semibold tracking-wider text-navy-900 uppercase">
            Recent Email Delivery Attempts
          </h2>
          {emailLogs.length === 0 ? (
            <p className="mt-3 text-xs text-muted">No email delivery attempts recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-xs">
              {emailLogs.map((l) => (
                <li key={l.id} className="py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold text-navy-900">
                      {l.template} {l.reference ? `(${l.reference})` : ""} → {l.recipient_masked}
                    </span>
                    <span
                      className={`font-semibold ${
                        l.status === "submitted_to_gmail" || l.status === "sent_fallback"
                          ? "text-teal-700"
                          : l.status === "skipped"
                            ? "text-amber-700"
                            : "text-rose-700"
                      }`}
                    >
                      {l.status} ({l.attempts} try)
                    </span>
                  </div>
                  {l.last_error && <p className="mt-0.5 text-rose-700">{l.last_error}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-sans text-sm font-semibold tracking-wider text-navy-900 uppercase">
            Recent Appointment Approval History
          </h2>
          {recentAudits.length === 0 ? (
            <p className="mt-3 text-xs text-muted">No audit entries recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-xs">
              {recentAudits.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <strong className="text-navy-900">{a.reference}</strong> · {a.action} ({a.actor}) → {a.new_status}
                  </span>
                  <span className="text-muted">
                    {new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
