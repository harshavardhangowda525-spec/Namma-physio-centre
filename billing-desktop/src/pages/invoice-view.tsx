import { ArrowLeft, Ban, Download, IndianRupee, Pencil, Printer, Receipt, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { amountInWords } from "../../shared/billing";
import type { Settings } from "../../server/settings";
import { del, get, post, saveAsPdf } from "../api";
import { useAuth } from "../auth";
import { Button, ErrorNote, Field, Modal, MoneyInput, StatusBadge, fmtDate, money, todayLocal, useLoad, useToast } from "../ui";

type Inv = {
  invoice: {
    id: number; invoice_no: string; invoice_date: string; subtotal: number; discount_total: number; tax_total: number; total: number; paid: number;
    status: string; notes: string | null; void_reason: string | null; patient_id: number; patient_name: string; patient_code: string;
    patient_phone: string | null; patient_address: string | null; created_by_name: string | null;
  };
  items: { id: number; description: string; quantity: number; unit_price: number; discount: number; tax_rate_bp: number; tax: number; total: number }[];
  payments: { id: number; receipt_no: string; amount: number; method: string; reference: string | null; paid_on: string; received_by_name: string | null }[];
};

function ClinicHeader({ s, compact }: { s: Settings; compact?: boolean }) {
  return (
    <div className={compact ? "text-center" : "flex items-start justify-between gap-6"}>
      <div className={compact ? "" : "flex items-start gap-4"}>
        {s.clinic.logoDataUrl && <img src={s.clinic.logoDataUrl} alt="" className={compact ? "mx-auto mb-1 h-10" : "h-16 w-16 object-contain"} />}
        <div>
          <p className={`font-display font-semibold text-navy-900 ${compact ? "text-base" : "text-2xl"}`}>{s.clinic.name}</p>
          {s.clinic.tagline && <p className={`${compact ? "text-[10px]" : "text-sm"} text-teal-700`}>{s.clinic.tagline}</p>}
          <p className={`${compact ? "text-[10px]" : "mt-1 max-w-sm text-xs"} text-muted`}>{s.clinic.address}</p>
          <p className={`${compact ? "text-[10px]" : "text-xs"} text-muted`}>
            {s.clinic.phone}{s.clinic.email && ` · ${s.clinic.email}`}{s.clinic.gstin && ` · GSTIN ${s.clinic.gstin}`}
          </p>
          {s.clinic.registrationNote && <p className={`${compact ? "text-[10px]" : "text-xs"} text-muted`}>{s.clinic.registrationNote}</p>}
        </div>
      </div>
    </div>
  );
}

function Paper({ children, format }: { children: ReactNode; format: "a4" | "receipt" }) {
  return (
    <div className="overflow-x-auto pb-6">
      <div
        className={`print-area card mx-auto bg-white text-ink ${format === "a4" ? "min-h-[297mm] w-[210mm] p-[16mm]" : "w-[80mm] p-[5mm] font-mono text-[11px]"}`}
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {children}
      </div>
    </div>
  );
}

function Signature({ s }: { s: Settings }) {
  if (!s.invoice.showSignature && !s.invoice.showStamp) return null;
  return (
    <div className="mt-14 flex items-end justify-between">
      {s.invoice.showStamp ? <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-dashed border-line text-center text-[10px] text-muted">Clinic stamp</div> : <span />}
      {s.invoice.showSignature && (
        <div className="w-56 text-center">
          <div className="border-t border-navy-900 pt-1 text-xs font-semibold text-navy-900">Authorised signatory</div>
          <p className="text-[10px] text-muted">For {s.clinic.name}</p>
        </div>
      )}
    </div>
  );
}

export function InvoiceViewPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const { data, error, reload } = useLoad(() => get<Inv>(`/invoices/${id}`), [id]);
  const { data: s } = useLoad(() => get<Settings>("/settings"), []);
  const [format, setFormat] = useState<"a4" | "receipt" | null>(null);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);

  if (error) return <ErrorNote error={error} />;
  if (!data || !s) return <p className="text-muted">Loading…</p>;
  const { invoice: inv, items, payments } = data;
  const fmt = format ?? s.invoice.defaultFormat;
  const balance = inv.total - inv.paid;
  const isVoid = inv.status === "void";
  const taxOnInvoice = inv.tax_total > 0;

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/invoices" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
          <h1 className="flex items-center gap-3 font-display text-3xl">{inv.invoice_no} <StatusBadge status={inv.status} /></h1>
          <p className="text-sm text-muted">{inv.patient_name} · <Link className="text-teal-700 hover:underline" to={`/patients/${inv.patient_id}`}>{inv.patient_code}</Link>{inv.created_by_name && ` · Created by ${inv.created_by_name}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl border border-line bg-white p-1" role="group" aria-label="Layout">
            {(["a4", "receipt"] as const).map((f) => (
              <button key={f} onClick={() => setFormat(f)} aria-pressed={fmt === f} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${fmt === f ? "bg-navy-900 text-white" : "text-navy-800"}`}>{f === "a4" ? "A4" : "Receipt (80mm)"}</button>
            ))}
          </div>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          <Button variant="secondary" onClick={() => saveAsPdf(`${inv.invoice_no.replace(/\//g, "-")} ${inv.patient_name}.pdf`)}><Download className="h-4 w-4" /> PDF</Button>
          {!isVoid && balance > 0 && can("payments.write") && <Button onClick={() => setPaying(true)}><IndianRupee className="h-4 w-4" /> Record payment</Button>}
          {!isVoid && inv.paid === 0 && can("invoices.write") && <Button variant="secondary" onClick={() => nav(`/invoices/${inv.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>}
          {!isVoid && can("invoices.void") && <Button variant="ghost" className="!text-rose-700" onClick={() => setVoiding(true)}><Ban className="h-4 w-4" /> Void</Button>}
        </div>
      </div>
      {isVoid && <p className="no-print mb-4 rounded-xl bg-slate-100 p-3 text-sm">This invoice is void. Reason: {inv.void_reason}</p>}

      <div className={fmt === "receipt" ? "receipt-print" : ""}>
        {fmt === "a4" ? (
          <Paper format="a4">
            <div className="relative flex h-full flex-col">
              {isVoid && <div className="pointer-events-none absolute inset-0 grid place-items-center text-[120px] font-bold text-rose-500/15 -rotate-12">VOID</div>}
              <div className="flex items-start justify-between border-b-2 border-navy-900 pb-6">
                <ClinicHeader s={s} />
                <div className="text-right">
                  <p className="text-xs font-semibold tracking-[0.25em] text-teal-700 uppercase">Invoice</p>
                  <p className="mt-1 text-lg font-semibold text-navy-900">{inv.invoice_no}</p>
                  <p className="text-sm text-muted">Date: {fmtDate(inv.invoice_date)}</p>
                  <p className="mt-2"><StatusBadge status={inv.status} /></p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">Billed to</p>
                  <p className="mt-1 font-semibold text-navy-900">{inv.patient_name}</p>
                  <p className="text-muted">Patient ID: {inv.patient_code}</p>
                  {inv.patient_phone && <p className="text-muted">{inv.patient_phone}</p>}
                  {inv.patient_address && <p className="max-w-xs text-muted">{inv.patient_address}</p>}
                </div>
              </div>
              <table className="mt-8 w-full text-sm">
                <thead>
                  <tr className="bg-navy-900 text-left text-xs text-white uppercase">
                    <th className="rounded-l-lg px-3 py-2.5">#</th><th className="px-3 py-2.5">Service</th><th className="px-3 py-2.5 text-right">Qty</th><th className="px-3 py-2.5 text-right">Rate</th><th className="px-3 py-2.5 text-right">Discount</th>
                    {taxOnInvoice && <th className="px-3 py-2.5 text-right">{s.tax.label}</th>}
                    <th className="rounded-r-lg px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {items.map((it, i) => (
                    <tr key={it.id} className="border-b border-line">
                      <td className="px-3 py-2.5 text-muted">{i + 1}</td><td className="px-3 py-2.5">{it.description}</td><td className="px-3 py-2.5 text-right">{it.quantity}</td>
                      <td className="px-3 py-2.5 text-right">{money(it.unit_price)}</td><td className="px-3 py-2.5 text-right">{it.discount ? `− ${money(it.discount)}` : "—"}</td>
                      {taxOnInvoice && <td className="px-3 py-2.5 text-right">{it.tax ? `${money(it.tax)} (${it.tax_rate_bp / 100}%)` : "—"}</td>}
                      <td className="px-3 py-2.5 text-right font-semibold">{money(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 flex justify-between gap-8">
                <div className="max-w-sm text-xs text-muted">
                  <p className="font-semibold text-navy-900">Amount in words</p>
                  <p>{amountInWords(inv.total)}</p>
                  {inv.notes && <><p className="mt-3 font-semibold text-navy-900">Notes</p><p className="whitespace-pre-wrap">{inv.notes}</p></>}
                </div>
                <dl className="num w-72 space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(inv.subtotal)}</dd></div>
                  {inv.discount_total > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>− {money(inv.discount_total)}</dd></div>}
                  {taxOnInvoice && <div className="flex justify-between"><dt className="text-muted">{s.tax.label}</dt><dd>{money(inv.tax_total)}</dd></div>}
                  <div className="flex justify-between border-t-2 border-navy-900 pt-2 text-base font-bold text-navy-900"><dt>Total</dt><dd>{money(inv.total)}</dd></div>
                  <div className="flex justify-between text-teal-700"><dt>Paid</dt><dd>{money(inv.paid)}</dd></div>
                  <div className={`flex justify-between font-semibold ${balance > 0 && !isVoid ? "text-rose-700" : ""}`}><dt>Balance due</dt><dd>{money(isVoid ? 0 : balance)}</dd></div>
                </dl>
              </div>
              {payments.length > 0 && (
                <div className="mt-8">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">Payments received</p>
                  <table className="mt-2 w-full text-xs">
                    <tbody className="num">{payments.map((p) => (
                      <tr key={p.id} className="border-b border-line"><td className="py-1.5">{p.receipt_no}</td><td>{fmtDate(p.paid_on)}</td><td>{p.method}{p.reference && ` (${p.reference})`}</td><td className="text-right font-semibold">{money(p.amount)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {s.tax.note && <p className="mt-6 text-xs text-muted">{s.tax.note}</p>}
              <Signature s={s} />
              <div className="mt-auto border-t border-line pt-4 text-center text-xs text-muted">
                {s.invoice.footerNote && <p className="font-medium text-navy-800">{s.invoice.footerNote}</p>}
                {s.invoice.terms && <p className="mt-1">{s.invoice.terms}</p>}
              </div>
            </div>
          </Paper>
        ) : (
          <Paper format="receipt">
            <ClinicHeader s={s} compact />
            <div className="my-2 border-t border-dashed border-ink/40" />
            <p className="text-center font-bold">{isVoid ? "VOID INVOICE" : "INVOICE"}</p>
            <p>No: {inv.invoice_no}</p><p>Date: {fmtDate(inv.invoice_date)}</p><p>Patient: {inv.patient_name} ({inv.patient_code})</p>
            <div className="my-2 border-t border-dashed border-ink/40" />
            {items.map((it) => (
              <div key={it.id} className="mb-1">
                <p>{it.description}</p>
                <p className="flex justify-between"><span>{it.quantity} × {money(it.unit_price)}{it.discount ? ` − ${money(it.discount)}` : ""}{it.tax ? ` + ${money(it.tax)}` : ""}</span><span>{money(it.total)}</span></p>
              </div>
            ))}
            <div className="my-2 border-t border-dashed border-ink/40" />
            <p className="flex justify-between font-bold"><span>TOTAL</span><span>{money(inv.total)}</span></p>
            <p className="flex justify-between"><span>Paid</span><span>{money(inv.paid)}</span></p>
            <p className="flex justify-between"><span>Balance</span><span>{money(isVoid ? 0 : balance)}</span></p>
            {payments.map((p) => <p key={p.id} className="text-[10px]">{fmtDate(p.paid_on)} {p.method} {money(p.amount)}</p>)}
            <div className="my-2 border-t border-dashed border-ink/40" />
            <p className="text-center text-[10px]">{s.invoice.footerNote}</p>
          </Paper>
        )}
      </div>

      {payments.length > 0 && (
        <div className="no-print card mx-auto mt-2 max-w-[210mm]">
          <h2 className="px-5 pt-5 font-semibold">Payments</h2>
          <table className="table mt-2"><tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.receipt_no}</td><td>{fmtDate(p.paid_on)}</td><td>{p.method}{p.reference && <span className="text-muted"> · {p.reference}</span>}</td>
                <td className="text-muted">{p.received_by_name}</td><td className="num text-right font-semibold">{money(p.amount)}</td>
                <td className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => nav(`/receipts/${p.id}`)}><Receipt className="h-4 w-4" /> Receipt</Button>
                  {can("invoices.void") && <DeletePayment id={p.id} onDone={() => (reload(), toast("Payment removed"))} />}
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      <Modal open={paying} onClose={() => setPaying(false)} title="Record payment">
        <PaymentForm invoiceId={inv.id} balance={balance} methods={s.paymentMethods} onDone={(rid) => (setPaying(false), reload(), toast("Payment recorded"), nav(`/receipts/${rid}`))} />
      </Modal>
      <Modal open={voiding} onClose={() => setVoiding(false)} title="Void invoice">
        <VoidForm invoiceId={inv.id} onDone={() => (setVoiding(false), reload(), toast("Invoice voided"))} />
      </Modal>
    </div>
  );
}

function PaymentForm({ invoiceId, balance, methods, onDone }: { invoiceId: number; balance: number; methods: string[]; onDone: (receiptId: number) => void }) {
  const [f, setF] = useState({ amount: balance, method: methods[0], reference: "", paidOn: todayLocal() });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setErr(null);
      try { onDone((await post<{ id: number }>(`/invoices/${invoiceId}/payments`, f)).id); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    }}>
      <p className="text-sm text-muted">Balance due: <span className="num font-semibold text-navy-900">{money(balance)}</span></p>
      <Field label="Amount"><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Method"><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{methods.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Date"><input type="date" className="input" value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></Field>
      </div>
      <Field label="Reference (optional)" hint="UPI / bank transaction ID"><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      <ErrorNote error={err} />
      <Button type="submit" loading={busy}>Save payment</Button>
    </form>
  );
}

function VoidForm({ invoiceId, onDone }: { invoiceId: number; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-4 text-sm">
      <p>Voiding keeps the invoice number in your records but removes it from revenue and outstanding totals. This cannot be undone.</p>
      <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry" /></Field>
      <ErrorNote error={err} />
      <Button variant="danger" disabled={reason.trim().length < 5} onClick={async () => {
        try { await post(`/invoices/${invoiceId}/void`, { reason }); onDone(); } catch (e) { setErr((e as Error).message); }
      }}>Void invoice</Button>
    </div>
  );
}

function DeletePayment({ id, onDone }: { id: number; onDone: () => void }) {
  return (
    <Button size="sm" variant="ghost" className="!text-rose-700" aria-label="Remove payment" onClick={async () => {
      const reason = window.prompt("Reason for removing this payment (recorded in the audit log):");
      if (!reason || reason.trim().length < 5) return;
      await del(`/payments/${id}`, { reason });
      onDone();
    }}><Trash2 className="h-4 w-4" /></Button>
  );
}

type Pay = { id: number; receipt_no: string; amount: number; method: string; reference: string | null; paid_on: string; invoice_id: number; invoice_no: string; invoice_total: number; invoice_paid: number; patient_name: string; patient_code: string; received_by_name: string | null };

export function ReceiptViewPage() {
  const { id } = useParams();
  const { data: p, error } = useLoad(() => get<Pay>(`/payments/${id}`), [id]);
  const { data: s } = useLoad(() => get<Settings>("/settings"), []);
  if (error) return <ErrorNote error={error} />;
  if (!p || !s) return <p className="text-muted">Loading…</p>;
  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/invoices/${p.invoice_id}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" /> Invoice {p.invoice_no}</Link>
          <h1 className="font-display text-3xl">Receipt {p.receipt_no}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
          <Button onClick={() => saveAsPdf(`Receipt ${p.receipt_no.replace(/\//g, "-")} ${p.patient_name}.pdf`)}><Download className="h-4 w-4" /> PDF</Button>
        </div>
      </div>
      <div className="overflow-x-auto pb-6">
        <div className="print-area card mx-auto w-[210mm] bg-white p-[16mm]">
          <div className="flex items-start justify-between border-b-2 border-navy-900 pb-6">
            <ClinicHeader s={s} />
            <div className="text-right">
              <p className="text-xs font-semibold tracking-[0.25em] text-teal-700 uppercase">Payment receipt</p>
              <p className="mt-1 text-lg font-semibold text-navy-900">{p.receipt_no}</p>
              <p className="text-sm text-muted">Date: {fmtDate(p.paid_on)}</p>
            </div>
          </div>
          <div className="mt-8 rounded-2xl bg-teal-50 p-6 text-center">
            <p className="text-sm text-muted">Amount received</p>
            <p className="num mt-1 font-display text-4xl text-navy-900">{money(p.amount)}</p>
            <p className="mt-1 text-xs text-muted">{amountInWords(p.amount)}</p>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div><dt className="text-xs text-muted uppercase">Received from</dt><dd className="font-semibold">{p.patient_name} ({p.patient_code})</dd></div>
            <div><dt className="text-xs text-muted uppercase">Towards invoice</dt><dd className="font-semibold">{p.invoice_no}</dd></div>
            <div><dt className="text-xs text-muted uppercase">Payment method</dt><dd>{p.method}{p.reference && ` · Ref ${p.reference}`}</dd></div>
            <div><dt className="text-xs text-muted uppercase">Received by</dt><dd>{p.received_by_name ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted uppercase">Invoice total</dt><dd className="num">{money(p.invoice_total)}</dd></div>
            <div><dt className="text-xs text-muted uppercase">Balance remaining on invoice</dt><dd className="num font-semibold">{money(p.invoice_total - p.invoice_paid)}</dd></div>
          </dl>
          <Signature s={s} />
          <p className="mt-10 border-t border-line pt-4 text-center text-xs text-muted">{s.invoice.footerNote}</p>
        </div>
      </div>
    </div>
  );
}
