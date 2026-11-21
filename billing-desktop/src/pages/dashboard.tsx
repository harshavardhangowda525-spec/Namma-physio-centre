import { AlertCircle, CalendarDays, FilePlus2, IndianRupee, Table2, BarChart3, UserPlus, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { get } from "../api";
import { useAuth } from "../auth";
import { Button, Empty, PageTitle, StatusBadge, fmtDate, money, useLoad } from "../ui";

type Dash = {
  financial: boolean;
  totalPatients: number;
  todayAppointments: number;
  upcomingAppointments: { id: number; date: string; time: string; visit_type: string; status: string; patient_name: string; patient_id: number; physiotherapist: string | null }[];
  recentInvoices: { id: number; invoice_no: string; invoice_date: string; total: number; paid: number; status: string; patient_name: string }[];
  todayCollected?: number;
  todayBilled?: number;
  monthCollected?: number;
  monthBilled?: number;
  outstanding?: { s: number; c: number };
  recentPayments?: { id: number; receipt_no: string; amount: number; method: string; paid_on: string; patient_name: string }[];
  trend?: { month: string; collected: number; billed: number }[];
  methods?: { method: string; total: number; count: number }[];
};

const SERIES = "#16978d"; // validated against the light surface (dataviz validator: all checks pass)

function Stat({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: typeof Wallet }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="num mt-3 font-display text-3xl text-navy-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short" });

/** Single-series column chart of monthly collections with hover tooltip and table view. */
function TrendChart({ data }: { data: NonNullable<Dash["trend"]> }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const W = 640, H = 220, pad = { l: 56, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.collected));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const bw = iw / data.length;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Collections, last 12 months</h2>
          <p className="text-xs text-muted">Payments received per month</p>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-semibold text-teal-700" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
          {asTable ? <><BarChart3 className="h-3.5 w-3.5" /> Chart</> : <><Table2 className="h-3.5 w-3.5" /> Table</>}
        </button>
      </div>
      {asTable ? (
        <table className="table mt-3">
          <thead><tr><th>Month</th><th className="text-right">Collected</th><th className="text-right">Billed</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.month}><td>{d.month}</td><td className="num text-right">{money(d.collected)}</td><td className="num text-right">{money(d.billed)}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly collections bar chart">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e6e1d6" strokeWidth={1} />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#5b6676">{compact(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = pad.l + i * bw + 2; // 2px gap each side
              const w = Math.max(2, bw - 4);
              const h = (d.collected / top) * ih;
              const r = Math.min(4, w / 2, h);
              const yy = pad.t + ih - h;
              return (
                <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent" />
                  {h > 0 && <path d={`M${x},${pad.t + ih} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + w - r} Q${x + w},${yy} ${x + w},${yy + r} V${pad.t + ih} Z`} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.45} />}
                  <text x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#5b6676">{monthLabel(d.month)}</text>
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute top-0 rounded-lg bg-navy-900 px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, transform: "translateX(-50%)" }}>
              <p className="font-semibold">{new Date(data[hover].month + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
              <p className="num">Collected {money(data[hover].collected)}</p>
              <p className="num text-white/70">Billed {money(data[hover].billed)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
}
function compact(paise: number) {
  const r = paise / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${(r / 1e3).toFixed(r >= 1e4 ? 0 : 1)}k`;
  return `₹${r}`;
}

function Methods({ rows }: { rows: NonNullable<Dash["methods"]> }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="card p-5">
      <h2 className="font-semibold">Payment methods</h2>
      <p className="text-xs text-muted">This month</p>
      {rows.length === 0 ? <Empty title="No payments yet this month" /> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.method} title={`${r.method}: ${money(r.total)} from ${r.count} payment(s)`}>
              <div className="flex justify-between text-sm"><span className="font-medium text-navy-900">{r.method}</span><span className="num text-muted">{money(r.total)} · {Math.round((r.total / total) * 100)}%</span></div>
              <div className="mt-1.5 h-2 rounded-full bg-cream"><div className="h-2 rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: SERIES }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user, can } = useAuth();
  const nav = useNavigate();
  const { data, error } = useLoad(() => get<Dash>("/dashboard"), []);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageTitle
        title={`${greet}, ${user?.displayName.split(" ").slice(0, 2).join(" ")}`}
        subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={<>
          {can("patients.write") && <Button variant="secondary" onClick={() => nav("/patients?new=1")}><UserPlus className="h-4 w-4" /> New patient</Button>}
          {can("invoices.write") && <Button onClick={() => nav("/invoices/new")}><FilePlus2 className="h-4 w-4" /> New invoice</Button>}
        </>}
      />
      {error && <p className="text-rose-600">{error}</p>}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.financial ? (
              <>
                <Stat label="Collected today" value={money(data.todayCollected)} sub={`Billed today ${money(data.todayBilled)}`} icon={IndianRupee} />
                <Stat label="Collected this month" value={money(data.monthCollected)} sub={`Billed this month ${money(data.monthBilled)}`} icon={Wallet} />
                <Stat label="Outstanding" value={money(data.outstanding?.s)} sub={`${data.outstanding?.c ?? 0} unpaid or part-paid invoices`} icon={AlertCircle} />
                <Stat label="Patients" value={String(data.totalPatients)} sub={`${data.todayAppointments} appointments today`} icon={Users} />
              </>
            ) : (
              <>
                <Stat label="Patients" value={String(data.totalPatients)} icon={Users} />
                <Stat label="Appointments today" value={String(data.todayAppointments)} icon={CalendarDays} />
              </>
            )}
          </div>

          {data.financial && data.trend && data.methods && (
            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              <TrendChart data={data.trend} />
              <Methods rows={data.methods} />
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card">
              <div className="flex items-center justify-between px-5 pt-5"><h2 className="font-semibold">Recent invoices</h2><Link to="/invoices" className="text-xs font-semibold text-teal-700">View all</Link></div>
              {data.recentInvoices.length === 0 ? <Empty title="No invoices yet" /> : (
                <table className="table mt-2"><tbody>
                  {data.recentInvoices.map((i) => (
                    <tr key={i.id} className="row-link" onClick={() => nav(`/invoices/${i.id}`)}>
                      <td><p className="font-medium text-navy-900">{i.patient_name}</p><p className="text-xs text-muted">{i.invoice_no} · {fmtDate(i.invoice_date)}</p></td>
                      <td className="num text-right">{money(i.total)}</td>
                      <td className="text-right"><StatusBadge status={i.status} /></td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </div>
            <div className="card">
              <div className="flex items-center justify-between px-5 pt-5"><h2 className="font-semibold">Upcoming appointments</h2><Link to="/appointments" className="text-xs font-semibold text-teal-700">View all</Link></div>
              {data.upcomingAppointments.length === 0 ? <Empty title="No upcoming appointments" /> : (
                <table className="table mt-2"><tbody>
                  {data.upcomingAppointments.map((a) => (
                    <tr key={a.id} className="row-link" onClick={() => nav(`/patients/${a.patient_id}`)}>
                      <td><p className="font-medium text-navy-900">{a.patient_name}</p><p className="text-xs text-muted capitalize">{a.visit_type} visit{a.physiotherapist ? ` · ${a.physiotherapist}` : ""}</p></td>
                      <td className="num text-right text-sm">{fmtDate(a.date)}<br /><span className="text-muted">{a.time}</span></td>
                      <td className="text-right"><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </div>
          </div>

          {data.financial && data.recentPayments && (
            <div className="card">
              <h2 className="px-5 pt-5 font-semibold">Recent transactions</h2>
              {data.recentPayments.length === 0 ? <Empty title="No payments recorded yet" /> : (
                <table className="table mt-2">
                  <thead><tr><th>Receipt</th><th>Patient</th><th>Method</th><th>Date</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>{data.recentPayments.map((p) => (
                    <tr key={p.id} className="row-link" onClick={() => nav(`/receipts/${p.id}`)}>
                      <td className="font-medium">{p.receipt_no}</td><td>{p.patient_name}</td><td>{p.method}</td><td>{fmtDate(p.paid_on)}</td><td className="num text-right font-semibold">{money(p.amount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
