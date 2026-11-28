import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Home,
  Inbox,
  KeyRound,
  Link2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Unplug,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { AppointmentInquiry, InquirySyncStatus } from "../../shared/types";
import { get, post } from "../api";
import { useAuth } from "../auth";
import { Button, Empty, ErrorNote, Field, Modal, PageTitle, fmtDate, useToast } from "../ui";

type InquiriesResponse = {
  items: AppointmentInquiry[];
  total: number;
  sync: InquirySyncStatus;
};

function fmtSubmittedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function fmtMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return mobile;
}

export function AppointmentInquiriesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const admin = can("settings.write");

  const [q, setQ] = useState("");
  const [visitType, setVisitType] = useState<"" | "clinic" | "home">("");
  const [data, setData] = useState<InquiriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  const knownTotal = useRef<number | null>(null);

  const loadList = useCallback(
    async (silent = false, suppressNewToast = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (visitType) params.set("visitType", visitType);
        params.set("limit", "200");
        const res = await get<InquiriesResponse>(`/inquiries?${params.toString()}`);
        setData(res);
        setError(null);
        if (!q.trim() && !visitType) {
          if (silent && !suppressNewToast && knownTotal.current !== null && res.total > knownTotal.current) {
            const diff = res.total - knownTotal.current;
            toast(`${diff} new website ${diff === 1 ? "inquiry" : "inquiries"} synchronized`);
          }
          knownTotal.current = res.total;
        }
      } catch (e) {
        if (!silent) setError((e as Error).message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [q, visitType, toast],
  );

  const runSync = useCallback(
    async (manual = false) => {
      setSyncing(true);
      try {
        const r = await post<{ added: number; status: InquirySyncStatus }>("/inquiries/sync");
        await loadList(true, manual);
        if (manual) {
          if (r.status.state === "offline") {
            toast("Offline — pending inquiries will sync automatically once reconnected", "error");
          } else if (r.added > 0) {
            toast(`Synchronized ${r.added} ${r.added === 1 ? "inquiry" : "inquiries"}`);
          } else {
            toast("Up to date with website");
          }
        }
      } catch (e) {
        if (manual) toast((e as Error).message, "error");
      } finally {
        setSyncing(false);
      }
    },
    [loadList, toast],
  );

  useEffect(() => {
    void loadList(false);
  }, [loadList]);

  // Trigger an immediate background sync on first mount when configured
  const didInitialSync = useRef(false);
  useEffect(() => {
    if (didInitialSync.current || !data?.sync.configured) return;
    didInitialSync.current = true;
    void runSync(false);
  }, [data?.sync.configured, runSync]);

  // Live auto-refresh and instant synchronization upon internet reconnection
  useEffect(() => {
    const onOnline = () => {
      setBrowserOnline(true);
      void runSync(false);
    };
    const onOffline = () => setBrowserOnline(false);
    const onFocus = () => {
      if (document.visibilityState === "visible") void runSync(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onFocus);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadList(true);
      }
    }, 8_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [loadList, runSync]);

  const sync = data?.sync;
  const isOffline = !browserOnline || sync?.state === "offline";

  return (
    <div>
      <PageTitle
        title="Appointment Inquiries"
        subtitle="Website appointment inquiries synchronized automatically, with the latest submissions at the top."
        actions={
          <div className="flex flex-wrap gap-2">
            {sync?.configured && (
              <Button variant="secondary" onClick={() => runSync(true)} loading={syncing}>
                <RefreshCw className="h-4 w-4" /> Sync now
              </Button>
            )}
            {admin && (
              <Button variant={sync?.configured ? "secondary" : "primary"} onClick={() => setConnectOpen(true)}>
                <Link2 className="h-4 w-4" /> {sync?.configured ? "Sync settings" : "Connect website"}
              </Button>
            )}
          </div>
        }
      />

      {/* Synchronization status banner */}
      {sync && (
        <div
          className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
            !sync.configured
              ? "border-amber-200 bg-amber-50/80 text-amber-950"
              : isOffline
                ? "border-amber-200 bg-amber-50/80 text-amber-950"
                : sync.state === "auth_error" || sync.state === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-teal-200 bg-teal-50/70 text-teal-950"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {!sync.configured ? (
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            ) : isOffline ? (
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            )}
            <div>
              {!sync.configured ? (
                <p>
                  <span className="font-semibold">Website sync not connected yet.</span>{" "}
                  {admin
                    ? "Connect once with the website admin password so inquiries submitted on the website transfer here automatically."
                    : "Ask a clinic administrator to connect website synchronization."}
                </p>
              ) : isOffline ? (
                <p>
                  <span className="font-semibold">Currently offline.</span> New inquiries stay safely stored on the website and will synchronize automatically when internet reconnects.
                </p>
              ) : sync.state === "auth_error" || sync.state === "error" ? (
                <p>
                  <span className="font-semibold">Sync issue:</span> {sync.lastError ?? "Could not reach the website."}
                </p>
              ) : (
                <p>
                  <span className="font-semibold">Automatic sync active</span> · Connected to{" "}
                  <span className="font-medium">{sync.websiteUrl}</span>
                  {sync.lastSyncAt && <span className="text-teal-800/85"> · Last synced {fmtSubmittedAt(sync.lastSyncAt)}</span>}
                </p>
              )}
            </div>
          </div>
          {sync.configured && (
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-navy-900 ring-1 ring-line">
              {sync.totalInquiries} {sync.totalInquiries === 1 ? "inquiry" : "inquiries"} stored locally
            </span>
          )}
        </div>
      )}

      {/* Search & visit type filter */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className="input pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by patient name, mobile, reference, locality or reason…"
            aria-label="Search appointment inquiries"
          />
        </div>
        <select
          className="input !w-44"
          value={visitType}
          onChange={(e) => setVisitType(e.target.value as "" | "clinic" | "home")}
          aria-label="Filter by visit type"
        >
          <option value="">All visit types</option>
          <option value="clinic">Clinic visit</option>
          <option value="home">Home visit</option>
        </select>
      </div>

      <ErrorNote error={error} />

      {loading && !data ? (
        <p className="text-muted">Loading…</p>
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <Empty icon={<Inbox className="h-5 w-5" />} title={q || visitType ? "No matching inquiries" : "No appointment inquiries yet"}>
            {q || visitType
              ? "Try clearing the search or visit type filter."
              : "When patients submit the appointment inquiry form on the website, their details appear here automatically."}
          </Empty>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.items.map((item) => (
            <article key={item.reference} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.visitType === "home"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-teal-100 text-teal-800"
                      }`}
                    >
                      {item.visitType === "home" ? (
                        <>
                          <Home className="h-3.5 w-3.5" /> Home visit
                        </>
                      ) : (
                        <>
                          <Building2 className="h-3.5 w-3.5" /> Clinic visit
                        </>
                      )}
                    </span>
                    <code className="rounded-lg bg-cream px-2 py-0.5 text-xs font-semibold text-navy-800">
                      {item.reference}
                    </code>
                    <span className="text-xs text-muted">
                      Submitted <b className="font-medium text-navy-900">{fmtSubmittedAt(item.submittedAt)}</b>
                    </span>
                  </div>

                  <h2 className="mt-3 font-display text-xl font-medium text-navy-900">{item.patientName}</h2>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-navy-800">
                    <span className="inline-flex items-center gap-1.5 font-medium text-teal-800">
                      <Phone className="h-3.5 w-3.5 text-teal-600" />
                      <span className="num">{fmtMobile(item.mobile)}</span>
                    </span>
                    {item.email && (
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <Mail className="h-3.5 w-3.5" />
                        {item.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-cream/70 px-4 py-2.5 text-sm sm:text-right">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                    <CalendarClock className="h-3.5 w-3.5 text-teal-600" /> Preferred slot
                  </p>
                  <p className="mt-0.5 font-semibold text-navy-900">{fmtDate(item.preferredDate)}</p>
                  <p className="text-xs text-muted">{item.preferredTime}</p>
                </div>
              </div>

              {item.visitType === "home" && (item.address || item.locality || item.pinCode) && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-ivory px-3.5 py-2.5 text-sm text-navy-900">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">Home visit address</p>
                    <p className="mt-0.5 whitespace-pre-wrap">
                      {[item.address, item.locality, item.pinCode ? `PIN ${item.pinCode}` : null]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              )}

              {(item.reason || item.notes) && (
                <div className="mt-3 grid gap-3 rounded-xl bg-cream p-3.5 text-sm sm:grid-cols-2">
                  {item.reason && (
                    <div className={item.notes ? "" : "sm:col-span-2"}>
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Reason for visit</p>
                      <p className="mt-0.5 text-navy-900">{item.reason}</p>
                    </div>
                  )}
                  {item.notes && (
                    <div className={item.reason ? "" : "sm:col-span-2"}>
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Additional notes</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-navy-900">{item.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                Patient consent recorded {fmtSubmittedAt(item.consentAt)}
              </p>
            </article>
          ))}
        </div>
      )}

      {admin && sync && (
        <Modal open={connectOpen} onClose={() => setConnectOpen(false)} title="Website inquiry synchronization">
          <ConnectWebsiteForm
            current={sync}
            onDone={() => {
              setConnectOpen(false);
              void loadList(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function ConnectWebsiteForm({ current, onDone }: { current: InquirySyncStatus; onDone: () => void }) {
  const toast = useToast();
  const [websiteUrl, setWebsiteUrl] = useState(current.websiteUrl);
  const [mode, setMode] = useState<"password" | "token">("password");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body =
        mode === "password"
          ? { websiteUrl, password }
          : { websiteUrl, token };
      const r = await post<{ added: number; status: InquirySyncStatus }>("/inquiries/connect", body);
      toast(
        r.added > 0
          ? `Connected and synchronized ${r.added} ${r.added === 1 ? "inquiry" : "inquiries"}`
          : "Website inquiry synchronization connected",
      );
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setErr(null);
    try {
      await post("/inquiries/disconnect");
      toast("Website synchronization disconnected");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      <p className="rounded-xl bg-teal-50/80 p-3 text-xs text-teal-900">
        Connects this local billing computer to your clinic website over HTTPS. Sync credentials are encrypted at rest on this PC, and inquiries submitted while this PC is offline are fetched automatically when internet reconnects.
      </p>

      <Field label="Clinic website URL" hint="Must use HTTPS (for example, https://namma-physio-centre-psi.vercel.app)">
        <input
          className="input"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          required
          placeholder="https://namma-physio-centre-psi.vercel.app"
        />
      </Field>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            mode === "password" ? "bg-navy-900 text-white" : "bg-cream text-navy-800"
          }`}
        >
          Pair with admin password
        </button>
        <button
          type="button"
          onClick={() => setMode("token")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            mode === "token" ? "bg-navy-900 text-white" : "bg-cream text-navy-800"
          }`}
        >
          Use sync token
        </button>
      </div>

      {mode === "password" ? (
        <Field label="Website admin password" hint="Used once to issue a dedicated sync key; your password is never stored.">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
      ) : (
        <Field label="Sync token" hint="20+ character Bearer token matching INQUIRY_SYNC_TOKEN or a paired token">
          <input
            className="input font-mono text-xs"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
        </Field>
      )}

      <ErrorNote error={err} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            <Link2 className="h-4 w-4" /> {current.configured ? "Reconnect & sync" : "Connect & sync"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
        {current.configured && (
          <Button type="button" variant="ghost" className="!text-rose-700" onClick={disconnect} loading={busy}>
            <Unplug className="h-4 w-4" /> Disconnect
          </Button>
        )}
      </div>
    </form>
  );
}
