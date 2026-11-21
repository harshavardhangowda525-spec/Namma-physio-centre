import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { BillingError, calcInvoice, percentDiscount, type LineInput } from "../../shared/billing";
import { get, post, put } from "../api";
import { useAuth } from "../auth";
import { PatientPicker, type PickedPatient } from "../patient-picker";
import type { Settings } from "../../server/settings";
import { Button, ErrorNote, Field, MoneyInput, PageTitle, money, todayLocal, useLoad, useToast } from "../ui";

type Service = { id: number; name: string; default_price: number; taxable: number; active: number };
type Line = LineInput & { key: number; discountMode: "amount" | "percent"; discountPercent: number };

let keySeq = 1;
const blank = (taxBp = 0): Line => ({ key: keySeq++, description: "", serviceId: null, quantity: 1, unitPrice: 0, discount: 0, taxRateBp: taxBp, discountMode: "amount", discountPercent: 0 });

export function InvoiceEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const editing = !!id;

  const { data: settings } = useLoad(() => get<Settings>("/settings"), []);
  const { data: services } = useLoad(() => get<Service[]>("/services"), []);
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [notes, setNotes] = useState("");
  const [payNow, setPayNow] = useState(false);
  const [payment, setPayment] = useState({ amount: 0, method: "", reference: "", touched: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill
  useEffect(() => {
    const pid = params.get("patient");
    if (pid && !editing) get<{ patient: PickedPatient }>(`/patients/${pid}`).then((d) => setPatient(d.patient));
  }, [params, editing]);
  useEffect(() => {
    if (!editing) return;
    get<{ invoice: { patient_id: number; patient_name: string; patient_code: string; invoice_date: string; notes: string | null; paid: number; status: string }; items: { service_id: number | null; description: string; quantity: number; unit_price: number; discount: number; tax_rate_bp: number }[] }>(`/invoices/${id}`).then((d) => {
      if (d.invoice.paid > 0 || d.invoice.status === "void") return nav(`/invoices/${id}`, { replace: true });
      setPatient({ id: d.invoice.patient_id, name: d.invoice.patient_name, patientCode: d.invoice.patient_code });
      setDate(d.invoice.invoice_date);
      setNotes(d.invoice.notes ?? "");
      setLines(d.items.map((i) => ({ key: keySeq++, serviceId: i.service_id, description: i.description, quantity: i.quantity, unitPrice: i.unit_price, discount: i.discount, taxRateBp: i.tax_rate_bp, discountMode: "amount", discountPercent: 0 })));
    });
  }, [editing, id, nav]);

  const taxOn = settings?.tax.enabled ?? false;
  const effective = (l: Line): LineInput => {
    const gross = l.quantity * l.unitPrice;
    const discount = l.discountMode === "percent" ? percentDiscount(gross, Math.min(100, Math.max(0, l.discountPercent))) : l.discount;
    return { description: l.description || "Item", serviceId: l.serviceId, quantity: l.quantity, unitPrice: l.unitPrice, discount, taxRateBp: taxOn ? l.taxRateBp : 0 };
  };
  const totals = useMemo(() => {
    try {
      return { ok: true as const, t: calcInvoice(lines.map(effective)) };
    } catch (e) {
      return { ok: false as const, error: e instanceof BillingError ? e.message : "Check the line items" };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, taxOn]);

  useEffect(() => {
    if (settings && !payment.method) setPayment((p) => ({ ...p, method: settings.paymentMethods[0] }));
  }, [settings, payment.method]);
  useEffect(() => {
    if (totals.ok && !payment.touched) setPayment((p) => ({ ...p, amount: totals.t.total }));
  }, [totals, payment.touched]);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const pickService = (key: number, sid: string) => {
    const s = services?.find((x) => x.id === Number(sid));
    if (!s) return update(key, { serviceId: null });
    update(key, { serviceId: s.id, description: s.name, unitPrice: s.default_price, taxRateBp: s.taxable && taxOn ? settings!.tax.defaultRateBp : 0 });
  };

  async function save() {
    setErr(null);
    if (!patient) return setErr("Choose a patient");
    if (lines.some((l) => !l.description.trim())) return setErr("Every line needs a description");
    if (!totals.ok) return setErr(totals.error);
    setBusy(true);
    try {
      const body = {
        patientId: patient.id,
        invoiceDate: date,
        notes,
        items: lines.map((l) => ({ ...effective(l), description: l.description.trim() })),
        payment: payNow && !editing && payment.amount > 0 ? { amount: payment.amount, method: payment.method, reference: payment.reference, paidOn: date } : null,
      };
      if (editing) {
        await put(`/invoices/${id}`, body);
        toast("Invoice updated");
        nav(`/invoices/${id}`);
      } else {
        const r = await post<{ id: number; invoiceNo: string }>("/invoices", body);
        toast(`Invoice ${r.invoiceNo} created`);
        nav(`/invoices/${r.id}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <Link to="/invoices" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
      <PageTitle title={editing ? "Edit invoice" : "New invoice"} subtitle={editing ? "Invoices can be edited until a payment is recorded." : "The invoice number is assigned automatically when you save."} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="card grid gap-4 p-5 sm:grid-cols-[1fr_200px]">
            <Field label="Patient"><PatientPicker value={patient} onChange={setPatient} autoFocus={!editing && !params.get("patient")} /></Field>
            <Field label="Invoice date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-semibold">Services</h2>
            <div className="space-y-4">
              {lines.map((l, idx) => {
                const eff = (() => { try { return calcInvoice([effective(l)]).lines[0]; } catch { return null; } })();
                return (
                  <div key={l.key} className="rounded-xl border border-line p-4">
                    <div className="grid gap-3 md:grid-cols-[200px_1fr]">
                      <Field label="Catalogue">
                        <select className="input" value={l.serviceId ?? ""} onChange={(e) => pickService(l.key, e.target.value)} aria-label={`Service for line ${idx + 1}`}>
                          <option value="">Custom item</option>
                          {services?.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Description"><input className="input" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} placeholder="e.g. Physiotherapy session" /></Field>
                    </div>
                    <div className={`mt-3 grid gap-3 ${taxOn ? "md:grid-cols-[100px_1fr_1.2fr_110px_1fr_40px]" : "md:grid-cols-[100px_1fr_1.2fr_1fr_40px]"}`}>
                      <Field label="Sessions / qty"><input className="input num text-right" type="number" min={1} max={1000} value={l.quantity} onChange={(e) => update(l.key, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></Field>
                      <Field label="Unit price"><MoneyInput value={l.unitPrice} onChange={(v) => update(l.key, { unitPrice: v })} /></Field>
                      <Field label="Discount">
                        <div className="flex gap-1">
                          <select className="input !w-16 !px-2" value={l.discountMode} onChange={(e) => update(l.key, { discountMode: e.target.value as "amount" | "percent" })} aria-label="Discount type"><option value="amount">₹</option><option value="percent">%</option></select>
                          {l.discountMode === "amount"
                            ? <MoneyInput value={l.discount} onChange={(v) => update(l.key, { discount: v })} aria-label="Discount amount" />
                            : <input className="input num text-right" type="number" min={0} max={100} step="0.5" value={l.discountPercent} onChange={(e) => update(l.key, { discountPercent: Number(e.target.value) || 0 })} aria-label="Discount percent" />}
                        </div>
                      </Field>
                      {taxOn && (
                        <Field label={`${settings?.tax.label ?? "Tax"} %`}>
                          <input className="input num text-right" type="number" min={0} max={50} step="0.5" value={l.taxRateBp / 100} onChange={(e) => update(l.key, { taxRateBp: Math.round((Number(e.target.value) || 0) * 100) })} />
                        </Field>
                      )}
                      <Field label="Line total"><div className="input num bg-cream text-right font-semibold">{eff ? money(eff.total) : <span className="text-rose-600">Check values</span>}</div></Field>
                      <div className="flex items-end">
                        <button type="button" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="grid h-[42px] w-10 place-items-center rounded-xl text-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30" aria-label={`Remove line ${idx + 1}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="h-4 w-4" /> Add line</Button>
          </div>

          <div className="card p-5"><Field label="Notes on invoice (optional)"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Package of 6 sessions, valid for 30 days" /></Field></div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <div className="card p-5">
            <h2 className="font-semibold">Summary</h2>
            {totals.ok ? (
              <dl className="num mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(totals.t.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>− {money(totals.t.discountTotal)}</dd></div>
                {taxOn && <div className="flex justify-between"><dt className="text-muted">{settings?.tax.label}</dt><dd>{money(totals.t.taxTotal)}</dd></div>}
                <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold text-navy-900"><dt>Total</dt><dd>{money(totals.t.total)}</dd></div>
              </dl>
            ) : <p className="mt-3 text-sm text-rose-600">{totals.error}</p>}
            {!taxOn && <p className="mt-3 text-xs text-muted">Tax is off. Turn it on in Settings if any of your services are taxable.</p>}
          </div>

          {!editing && can("payments.write") && (
            <div className="card p-5">
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-teal-600" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} /> Record payment now</label>
              {payNow && (
                <div className="mt-4 space-y-3">
                  <Field label="Amount received"><MoneyInput value={payment.amount} onChange={(v) => setPayment({ ...payment, amount: v, touched: true })} /></Field>
                  <Field label="Method"><select className="input" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>{settings?.paymentMethods.map((m) => <option key={m}>{m}</option>)}</select></Field>
                  <Field label="Reference (optional)" hint="UPI / transaction ID"><input className="input" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} /></Field>
                  {totals.ok && payment.amount > totals.t.total && <p className="text-xs text-rose-600">Amount is more than the invoice total.</p>}
                  {totals.ok && payment.amount < totals.t.total && payment.amount > 0 && <p className="text-xs text-muted">Balance after payment: {money(totals.t.total - payment.amount)}</p>}
                </div>
              )}
            </div>
          )}
          <ErrorNote error={err} />
          <Button className="w-full" loading={busy} onClick={save}>{editing ? "Save invoice" : "Create invoice"}</Button>
        </div>
      </div>
    </div>
  );
}
