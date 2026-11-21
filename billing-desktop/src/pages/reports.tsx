import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { downloadCsv, get, saveAsPdf } from "../api";
import { useAuth } from "../auth";
import { Button, Empty, PageTitle, StatusBadge, fmtDate, money, todayLocal, useLoad } from "../ui";

type Tab = "revenue" | "outstanding" | "services" | "methods" | "patients";
const tabs: { id: Tab; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "outstanding", label: "Outstanding" },
  { id: "services", label: "Service-wise" },
  { id: "methods", label: "Payment methods" },
  { id: "patients", label: "Patient billing" },
];
const rupees = (p: number) => (p / 100).toFixed(2);
const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA").format(d);
};

export function ReportsPage() {
  const { clinicName } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("revenue");
  const t = todayLocal();
  const [from, setFrom] = useState(t.slice(0, 8) + "01");
  const [to, setTo] = useState(t);
  const [group, setGroup] = useState<"day" | "week" | "month">("day");
  const presets = [
    { label: "Today", f: t, t },
    { label: "Last 7 days", f: shift(t, -6), t },
    { label: "This month", f: t.slice(0, 8) + "01", t },
    { label: "Last 12 months", f: shift(t, -364), t },
  ];
  const qs = `from=${from}&to=${to}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error } = useLoad<any>(() => get(tab === "revenue" ? `/reports/revenue?${qs}&group=${group}` : tab === "outstanding" ? "/reports/outstanding" : `/reports/${tab}?${qs}`), [tab, from, to, group]);

  function exportCsv() {
    if (!data) return;
    const name = `${tab}-report-${tab === "outstanding" ? t : `${from}_to_${to}`}.csv`;
    if (tab === "revenue") downloadCsv(name, [["Period", "Invoices", "Billed (INR)", "Discounts (INR)", "Tax (INR)", "Payments", "Collected (INR)"], ...data.rows.map((r: Record<string, number>) => [r.period, r.invoices, rupees(r.billed), rupees(r.discounts), rupees(r.tax), r.payments, rupees(r.collected)]), ["Total", data.totals.invoices, rupees(data.totals.billed), rupees(data.totals.discounts), rupees(data.totals.tax), data.totals.payments, rupees(data.totals.collected)]]);
    if (tab === "outstanding") downloadCsv(name, [["Invoice", "Date", "Patient", "Patient ID", "Phone", "Total (INR)", "Paid (INR)", "Balance (INR)", "Age (days)"], ...data.rows.map((r: Record<string, string & number>) => [r.invoice_no, r.invoice_date, r.patient_name, r.patient_code, r.patient_phone, rupees(r.total), rupees(r.paid), rupees(r.balance), r.age_days])]);
    if (tab === "services") downloadCsv(name, [["Service", "Quantity", "Gross (INR)", "Discounts (INR)", "Tax (INR)", "Net (INR)", "Invoices"], ...data.rows.map((r: Record<string, string & number>) => [r.service, r.quantity, rupees(r.gross), rupees(r.discounts), rupees(r.tax), rupees(r.total), r.invoices])]);
    if (tab === "methods") downloadCsv(name, [["Method", "Payments", "Amount (INR)"], ...data.rows.map((r: Record<string, string & number>) => [r.method, r.count, rupees(r.total)])]);
    if (tab === "patients") downloadCsv(name, [["Patient ID", "Name", "Invoices", "Billed (INR)", "Paid (INR)", "Outstanding (INR)", "Last invoice"], ...data.rows.map((r: Record<string, string & number>) => [r.patient_code, r.name, r.invoices, rupees(r.billed), rupees(r.paid), rupees(r.outstanding), r.last_invoice])]);
  }

  return (
    <div>
      <PageTitle title="Reports" subtitle="All figures are calculated from your local records." actions={<>
        <Button variant="secondary" onClick={exportCsv} disabled={!data}><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        <Button onClick={() => saveAsPdf(`${tab} report ${from} to ${to}.pdf`)}><Download className="h-4 w-4" /> PDF</Button>
      </>} />

      <div className="no-print mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1" role="tablist">
        {tabs.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === x.id ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-teal-50"}`}>{x.label}</button>)}
      </div>
      {tab !== "outstanding" && (
        <div className="no-print card mb-4 flex flex-wrap items-end gap-3 p-4">
          <label><span className="label">From</span><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">To</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          {tab === "revenue" && (
            <label><span className="label">Group by</span>
              <select className="input" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select>
            </label>
          )}
          <div className="flex flex-wrap gap-1">{presets.map((p) => <Button key={p.label} size="sm" variant={from === p.f && to === p.t ? "primary" : "ghost"} onClick={() => (setFrom(p.f), setTo(p.t))}>{p.label}</Button>)}</div>
        </div>
      )}

      <div className="print-area card">
        <div className="hidden border-b border-line p-5 print:block">
          <p className="font-display text-xl text-navy-900">{clinicName} — {tabs.find((x) => x.id === tab)?.label} report</p>
          <p className="text-xs text-muted">{tab === "outstanding" ? `As of ${fmtDate(t)}` : `${fmtDate(from)} to ${fmtDate(to)}`} · Generated {new Date().toLocaleString("en-IN")}</p>
        </div>
        {error && <p className="p-5 text-rose-600">{error}</p>}
        {data && (
          <div className={loading ? "opacity-60" : ""}>
            {tab === "revenue" && (
              <>
                <div className="grid grid-cols-2 divide-x divide-line border-b border-line md:grid-cols-4">
                  {[["Billed", data.totals.billed], ["Collected", data.totals.collected], ["Discounts given", data.totals.discounts], ["Tax", data.totals.tax]].map(([k, v]) => (
                    <div key={k as string} className="p-5"><p className="text-xs text-muted uppercase">{k}</p><p className="num mt-1 text-xl font-semibold text-navy-900">{money(v as number)}</p></div>
                  ))}
                </div>
                {data.rows.length === 0 ? <Empty title="No activity in this period" /> : (
                  <table className="table">
                    <thead><tr><th>Period</th><th className="text-right">Invoices</th><th className="text-right">Billed</th><th className="text-right">Discounts</th><th className="text-right">Tax</th><th className="text-right">Payments</th><th className="text-right">Collected</th></tr></thead>
                    <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                      <tr key={r.period}><td>{group === "day" ? fmtDate(r.period) : r.period}</td><td className="text-right">{r.invoices}</td><td className="text-right">{money(r.billed)}</td><td className="text-right">{money(r.discounts)}</td><td className="text-right">{money(r.tax)}</td><td className="text-right">{r.payments}</td><td className="text-right font-semibold">{money(r.collected)}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </>
            )}
            {tab === "outstanding" && (
              <>
                <div className="grid grid-cols-2 divide-x divide-line border-b border-line md:grid-cols-5">
                  <div className="p-5"><p className="text-xs text-muted uppercase">Total outstanding</p><p className="num mt-1 text-xl font-semibold text-rose-700">{money(data.total)}</p></div>
                  {Object.entries(data.buckets as Record<string, number>).map(([k, v]) => <div key={k} className="p-5"><p className="text-xs text-muted uppercase">{k} days</p><p className="num mt-1 text-xl font-semibold">{money(v)}</p></div>)}
                </div>
                {data.rows.length === 0 ? <Empty title="Nothing outstanding — all invoices are settled" /> : (
                  <table className="table">
                    <thead><tr><th>Invoice</th><th>Date</th><th>Patient</th><th>Phone</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th className="text-right">Age</th><th>Status</th></tr></thead>
                    <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                      <tr key={r.id} className="row-link" onClick={() => nav(`/invoices/${r.id}`)}><td className="font-medium">{r.invoice_no}</td><td>{fmtDate(r.invoice_date)}</td><td>{r.patient_name}</td><td>{r.patient_phone ?? "—"}</td><td className="text-right">{money(r.total)}</td><td className="text-right">{money(r.paid)}</td><td className="text-right font-semibold text-rose-700">{money(r.balance)}</td><td className="text-right">{r.age_days}d</td><td><StatusBadge status={r.status} /></td></tr>
                    ))}</tbody>
                  </table>
                )}
              </>
            )}
            {tab === "services" && (data.rows.length === 0 ? <Empty title="No services billed in this period" /> : (
              <table className="table">
                <thead><tr><th>Service</th><th className="text-right">Qty / sessions</th><th className="text-right">Gross</th><th className="text-right">Discounts</th><th className="text-right">Tax</th><th className="text-right">Net revenue</th><th className="text-right">Share</th></tr></thead>
                <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                  <tr key={r.service}><td className="font-medium">{r.service}</td><td className="text-right">{r.quantity}</td><td className="text-right">{money(r.gross)}</td><td className="text-right">{money(r.discounts)}</td><td className="text-right">{money(r.tax)}</td><td className="text-right font-semibold">{money(r.total)}</td><td className="text-right text-muted">{data.total ? Math.round((r.total / data.total) * 100) : 0}%</td></tr>
                ))}</tbody>
              </table>
            ))}
            {tab === "methods" && (data.rows.length === 0 ? <Empty title="No payments in this period" /> : (
              <table className="table">
                <thead><tr><th>Method</th><th className="text-right">Payments</th><th className="text-right">Amount</th><th className="text-right">Share</th></tr></thead>
                <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                  <tr key={r.method}><td className="font-medium">{r.method}</td><td className="text-right">{r.count}</td><td className="text-right font-semibold">{money(r.total)}</td><td className="text-right text-muted">{data.total ? Math.round((r.total / data.total) * 100) : 0}%</td></tr>
                ))}</tbody>
                <tfoot><tr><td className="font-semibold">Total</td><td /><td className="num text-right font-semibold">{money(data.total)}</td><td /></tr></tfoot>
              </table>
            ))}
            {tab === "patients" && (data.rows.length === 0 ? <Empty title="No billing in this period" /> : (
              <table className="table">
                <thead><tr><th>Patient</th><th>ID</th><th className="text-right">Invoices</th><th className="text-right">Billed</th><th className="text-right">Paid</th><th className="text-right">Outstanding</th><th>Last invoice</th></tr></thead>
                <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                  <tr key={r.id} className="row-link" onClick={() => nav(`/patients/${r.id}`)}><td className="font-medium">{r.name}</td><td className="text-muted">{r.patient_code}</td><td className="text-right">{r.invoices}</td><td className="text-right">{money(r.billed)}</td><td className="text-right">{money(r.paid)}</td><td className={`text-right ${r.outstanding ? "font-semibold text-rose-700" : ""}`}>{money(r.outstanding)}</td><td>{fmtDate(r.last_invoice)}</td></tr>
                ))}</tbody>
              </table>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
