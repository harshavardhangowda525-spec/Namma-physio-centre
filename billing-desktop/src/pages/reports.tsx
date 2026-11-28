import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { downloadCsv, get, saveAsPdf } from "../api";
import { useAuth } from "../auth";
import { downloadReportPdf } from "../pdf";
import { Button, Empty, PageTitle, StatusBadge, fmtDate, money, todayLocal, useLoad, useToast } from "../ui";

type Tab = "revenue" | "outstanding" | "payments" | "services" | "methods" | "patients";
const tabs: { id: Tab; label: string }[] = [
  { id: "revenue", label: "Daily & monthly revenue" },
  { id: "outstanding", label: "Outstanding payments" },
  { id: "payments", label: "Payment history" },
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
  const toast = useToast();
  const [params] = useSearchParams();
  const initialTab = tabs.find((x) => x.id === params.get("tab"))?.id ?? "revenue";
  const [tab, setTab] = useState<Tab>(initialTab);
  const t = todayLocal();
  const [from, setFrom] = useState(t.slice(0, 8) + "01");
  const [to, setTo] = useState(t);
  const [group, setGroup] = useState<"day" | "week" | "month">("day");
  const presets = [
    { label: "Today", f: t, t, g: "day" as const },
    { label: "Last 7 days", f: shift(t, -6), t, g: "day" as const },
    { label: "This month", f: t.slice(0, 8) + "01", t, g: "day" as const },
    { label: "Last 12 months", f: shift(t, -364), t, g: "month" as const },
  ];
  const qs = `from=${from}&to=${to}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error } = useLoad<any>(
    () => get(tab === "revenue" ? `/reports/revenue?${qs}&group=${group}` : tab === "outstanding" ? "/reports/outstanding" : `/reports/${tab}?${qs}`),
    [tab, from, to, group],
  );

  function exportCsv() {
    if (!data) return;
    const name = `${tab}-report-${tab === "outstanding" ? t : `${from}_to_${to}`}.csv`;
    if (tab === "revenue") downloadCsv(name, [["Period", "Invoices", "Billed (INR)", "Discounts (INR)", "Tax (INR)", "Payments", "Collected (INR)"], ...data.rows.map((r: Record<string, number>) => [r.period, r.invoices, rupees(r.billed), rupees(r.discounts), rupees(r.tax), r.payments, rupees(r.collected)]), ["Total", data.totals.invoices, rupees(data.totals.billed), rupees(data.totals.discounts), rupees(data.totals.tax), data.totals.payments, rupees(data.totals.collected)]]);
    if (tab === "outstanding") downloadCsv(name, [["Invoice", "Date", "Patient", "Patient ID", "Phone", "Total (INR)", "Paid (INR)", "Balance (INR)", "Age (days)"], ...data.rows.map((r: Record<string, string & number>) => [r.invoice_no, r.invoice_date, r.patient_name, r.patient_code, r.patient_phone, rupees(r.total), rupees(r.paid), rupees(r.balance), r.age_days])]);
    if (tab === "payments") downloadCsv(name, [["Receipt No", "Date", "Patient", "Patient ID", "Invoice No", "Method", "Reference", "Amount (INR)"], ...data.rows.map((r: Record<string, string & number>) => [r.receipt_no, r.paid_on, r.patient_name, r.patient_code, r.invoice_no, r.method, r.reference ?? "", rupees(r.amount)])]);
    if (tab === "services") downloadCsv(name, [["Service", "Quantity", "Gross (INR)", "Discounts (INR)", "Tax (INR)", "Net (INR)", "Invoices"], ...data.rows.map((r: Record<string, string & number>) => [r.service, r.quantity, rupees(r.gross), rupees(r.discounts), rupees(r.tax), rupees(r.total), r.invoices])]);
    if (tab === "methods") downloadCsv(name, [["Method", "Payments", "Amount (INR)"], ...data.rows.map((r: Record<string, string & number>) => [r.method, r.count, rupees(r.total)])]);
    if (tab === "patients") downloadCsv(name, [["Patient ID", "Name", "Invoices", "Billed (INR)", "Paid (INR)", "Outstanding (INR)", "Last invoice"], ...data.rows.map((r: Record<string, string & number>) => [r.patient_code, r.name, r.invoices, rupees(r.billed), rupees(r.paid), rupees(r.outstanding), r.last_invoice])]);
    toast("CSV report downloaded");
  }

  function exportPdf() {
    if (!data) return;
    const fileName = `${tab}-report-${tab === "outstanding" ? t : `${from}-to-${to}`}.pdf`;
    if (window.desktop) return void saveAsPdf(fileName);
    const label = tabs.find((x) => x.id === tab)?.label ?? "Report";
    const subtitle = tab === "outstanding" ? `As of ${fmtDate(t)}` : `${fmtDate(from)} to ${fmtDate(to)}`;

    if (tab === "revenue") {
      downloadReportPdf({
        clinicName, title: label, subtitle, fileName,
        kpis: [
          { label: "Total Billed", value: `Rs. ${rupees(data.totals.billed)}` },
          { label: "Total Collected", value: `Rs. ${rupees(data.totals.collected)}` },
          { label: "Discounts", value: `Rs. ${rupees(data.totals.discounts)}` },
          { label: "Payments", value: String(data.totals.payments) },
        ],
        headers: ["Period", "Invoices", "Billed (INR)", "Discounts", "Payments", "Collected (INR)"],
        rightAlignCols: [1, 2, 3, 4, 5],
        rows: data.rows.map((r: Record<string, number & string>) => [
          group === "day" ? fmtDate(r.period) : r.period, r.invoices, rupees(r.billed), rupees(r.discounts), r.payments, rupees(r.collected),
        ]),
      });
    } else if (tab === "outstanding") {
      downloadReportPdf({
        clinicName, title: label, subtitle, fileName,
        kpis: [
          { label: "Total Outstanding", value: `Rs. ${rupees(data.total)}` },
          { label: "0-30 Days", value: `Rs. ${rupees(data.buckets["0-30"])}` },
          { label: "31-60 Days", value: `Rs. ${rupees(data.buckets["31-60"])}` },
          { label: "61+ Days", value: `Rs. ${rupees(data.buckets["61-90"] + data.buckets["90+"])}` },
        ],
        headers: ["Invoice", "Date", "Patient", "Total (INR)", "Paid (INR)", "Balance (INR)", "Age"],
        rightAlignCols: [3, 4, 5, 6],
        rows: data.rows.map((r: Record<string, number & string>) => [
          r.invoice_no, fmtDate(r.invoice_date), r.patient_name, rupees(r.total), rupees(r.paid), rupees(r.balance), `${r.age_days}d`,
        ]),
      });
    } else if (tab === "payments") {
      downloadReportPdf({
        clinicName, title: label, subtitle, fileName,
        kpis: [
          { label: "Receipts Count", value: String(data.count) },
          { label: "Total Collected", value: `Rs. ${rupees(data.total)}` },
        ],
        headers: ["Receipt No", "Date", "Patient", "Invoice", "Method", "Amount (INR)"],
        rightAlignCols: [5],
        rows: data.rows.map((r: Record<string, number & string>) => [
          r.receipt_no, fmtDate(r.paid_on), r.patient_name, r.invoice_no, r.method, rupees(r.amount),
        ]),
      });
    } else if (tab === "services") {
      downloadReportPdf({
        clinicName, title: label, subtitle, fileName,
        kpis: [{ label: "Net Service Revenue", value: `Rs. ${rupees(data.total)}` }],
        headers: ["Service", "Sessions", "Gross (INR)", "Discounts", "Net (INR)"],
        rightAlignCols: [1, 2, 3, 4],
        rows: data.rows.map((r: Record<string, number & string>) => [
          r.service, r.quantity, rupees(r.gross), rupees(r.discounts), rupees(r.total),
        ]),
      });
    } else if (tab === "methods") {
      downloadReportPdf({
        clinicName, title: label, subtitle, fileName,
        kpis: [{ label: "Total Collected", value: `Rs. ${rupees(data.total)}` }],
        headers: ["Payment Method", "Transactions", "Amount (INR)"],
        rightAlignCols: [1, 2],
        rows: data.rows.map((r: Record<string, number & string>) => [r.method, r.count, rupees(r.total)]),
      });
    } else {
      downloadReportPdf({
        clinicName, title: label, subtitle, fileName,
        headers: ["Patient", "ID", "Invoices", "Billed (INR)", "Paid (INR)", "Due (INR)"],
        rightAlignCols: [2, 3, 4, 5],
        rows: data.rows.map((r: Record<string, number & string>) => [
          r.name, r.patient_code, r.invoices, rupees(r.billed), rupees(r.paid), rupees(r.outstanding),
        ]),
      });
    }
    toast("Report PDF downloaded");
  }

  return (
    <div>
      <PageTitle title="Reports" subtitle="Daily collections, monthly revenue, outstanding balances and payment history." actions={<>
        <Button variant="secondary" onClick={exportCsv} disabled={!data}><FileSpreadsheet className="h-4 w-4" /> CSV</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        <Button onClick={exportPdf} disabled={!data}><Download className="h-4 w-4" /> Download PDF</Button>
      </>} />

      <div className="no-print mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1" role="tablist">
        {tabs.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${tab === x.id ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-teal-50"}`}>{x.label}</button>)}
      </div>
      {tab !== "outstanding" && (
        <div className="no-print card mb-4 flex flex-wrap items-end gap-3 p-4">
          <label><span className="label">From</span><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">To</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          {tab === "revenue" && (
            <label><span className="label">Group by</span>
              <select className="input" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}><option value="day">Daily collections</option><option value="week">Weekly</option><option value="month">Monthly revenue</option></select>
            </label>
          )}
          <div className="flex flex-wrap gap-1">{presets.map((p) => <Button key={p.label} size="sm" variant={from === p.f && to === p.t ? "primary" : "ghost"} onClick={() => { setFrom(p.f); setTo(p.t); if (tab === "revenue") setGroup(p.g); }}>{p.label}</Button>)}</div>
        </div>
      )}

      <div className="print-area card overflow-hidden">
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
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead><tr><th>Period</th><th className="text-right">Invoices</th><th className="text-right">Billed</th><th className="text-right">Discounts</th><th className="text-right">Tax</th><th className="text-right">Payments</th><th className="text-right">Collected</th></tr></thead>
                      <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                        <tr key={r.period}><td>{group === "day" ? fmtDate(r.period) : r.period}</td><td className="text-right">{r.invoices}</td><td className="text-right">{money(r.billed)}</td><td className="text-right">{money(r.discounts)}</td><td className="text-right">{money(r.tax)}</td><td className="text-right">{r.payments}</td><td className="text-right font-semibold">{money(r.collected)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
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
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead><tr><th>Invoice</th><th>Date</th><th>Patient</th><th>Phone</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th className="text-right">Age</th><th>Status</th></tr></thead>
                      <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                        <tr key={r.id} className="row-link" onClick={() => nav(`/invoices/${r.id}`)}><td className="font-medium">{r.invoice_no}</td><td>{fmtDate(r.invoice_date)}</td><td>{r.patient_name}</td><td>{r.patient_phone ?? "—"}</td><td className="text-right">{money(r.total)}</td><td className="text-right">{money(r.paid)}</td><td className="text-right font-semibold text-rose-700">{money(r.balance)}</td><td className="text-right">{r.age_days}d</td><td><StatusBadge status={r.status} /></td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {tab === "payments" && (
              <>
                <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                  <div className="p-5"><p className="text-xs text-muted uppercase">Total collected</p><p className="num mt-1 text-xl font-semibold text-teal-700">{money(data.total)}</p></div>
                  <div className="p-5"><p className="text-xs text-muted uppercase">Receipts recorded</p><p className="num mt-1 text-xl font-semibold text-navy-900">{data.count}</p></div>
                </div>
                {data.rows.length === 0 ? <Empty title="No payments in this period" /> : (
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead><tr><th>Receipt</th><th>Date</th><th>Patient</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
                      <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                        <tr key={r.id} className="row-link" onClick={() => nav(`/receipts/${r.id}`)}>
                          <td className="font-medium text-navy-900">{r.receipt_no}</td>
                          <td>{fmtDate(r.paid_on)}</td>
                          <td>{r.patient_name} <span className="text-xs text-muted">{r.patient_code}</span></td>
                          <td className="text-teal-700">{r.invoice_no}</td>
                          <td>{r.method}</td>
                          <td className="text-muted">{r.reference ?? "—"}</td>
                          <td className="text-right font-semibold">{money(r.amount)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {tab === "services" && (data.rows.length === 0 ? <Empty title="No services billed in this period" /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Service</th><th className="text-right">Qty / sessions</th><th className="text-right">Gross</th><th className="text-right">Discounts</th><th className="text-right">Tax</th><th className="text-right">Net revenue</th><th className="text-right">Share</th></tr></thead>
                  <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                    <tr key={r.service}><td className="font-medium">{r.service}</td><td className="text-right">{r.quantity}</td><td className="text-right">{money(r.gross)}</td><td className="text-right">{money(r.discounts)}</td><td className="text-right">{money(r.tax)}</td><td className="text-right font-semibold">{money(r.total)}</td><td className="text-right text-muted">{data.total ? Math.round((r.total / data.total) * 100) : 0}%</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
            {tab === "methods" && (data.rows.length === 0 ? <Empty title="No payments in this period" /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Method</th><th className="text-right">Payments</th><th className="text-right">Amount</th><th className="text-right">Share</th></tr></thead>
                  <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                    <tr key={r.method}><td className="font-medium">{r.method}</td><td className="text-right">{r.count}</td><td className="text-right font-semibold">{money(r.total)}</td><td className="text-right text-muted">{data.total ? Math.round((r.total / data.total) * 100) : 0}%</td></tr>
                  ))}</tbody>
                  <tfoot><tr><td className="font-semibold">Total</td><td /><td className="num text-right font-semibold">{money(data.total)}</td><td /></tr></tfoot>
                </table>
              </div>
            ))}
            {tab === "patients" && (data.rows.length === 0 ? <Empty title="No billing in this period" /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Patient</th><th>ID</th><th className="text-right">Invoices</th><th className="text-right">Billed</th><th className="text-right">Paid</th><th className="text-right">Outstanding</th><th>Last invoice</th></tr></thead>
                  <tbody className="num">{data.rows.map((r: Record<string, number & string>) => (
                    <tr key={r.id} className="row-link" onClick={() => nav(`/patients/${r.id}`)}><td className="font-medium">{r.name}</td><td className="text-muted">{r.patient_code}</td><td className="text-right">{r.invoices}</td><td className="text-right">{money(r.billed)}</td><td className="text-right">{money(r.paid)}</td><td className={`text-right ${r.outstanding ? "font-semibold text-rose-700" : ""}`}>{money(r.outstanding)}</td><td>{fmtDate(r.last_invoice)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
