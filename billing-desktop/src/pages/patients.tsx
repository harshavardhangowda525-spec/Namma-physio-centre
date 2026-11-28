import { ArrowLeft, Download, FilePlus2, FileText, Plus, X, Lock, Pencil, Search, Trash2, UserPlus, Users, CalendarPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { AppointmentForm } from "./appointments";
import type { Settings } from "../../server/settings";
import { downloadDetailedBillPdf } from "../pdf";
import { Button, Empty, ErrorNote, Field, Modal, PageTitle, StatusBadge, fmtDate, fmtDateTime, money, useLoad, useToast } from "../ui";

type Patient = {
  id: number; patientCode: string; name: string; phone: string | null; email: string | null; gender: string | null; dateOfBirth: string | null;
  address: string | null; emergencyContact: string | null; adminNotes: string | null; consentRecordedAt: string | null; anonymisedAt: string | null;
  createdAt: string; outstanding?: number; lastInvoice?: string | null;
};

export function PatientForm({ initial, onSaved, onCancel }: { initial?: Patient; onSaved: (id: number) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", gender: initial?.gender ?? "",
    dateOfBirth: initial?.dateOfBirth ?? "", address: initial?.address ?? "", emergencyContact: initial?.emergencyContact ?? "",
    adminNotes: initial?.adminNotes ?? "", consentRecorded: initial ? !!initial.consentRecordedAt : true,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (initial) {
        await put(`/patients/${initial.id}`, f);
        onSaved(initial.id);
      } else onSaved((await post<{ id: number }>("/patients", f)).id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" className="sm:col-span-2"><input className="input" value={f.name} onChange={set("name")} required /></Field>
      <Field label="Mobile"><input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
      <Field label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
      <Field label="Gender">
        <select className="input" value={f.gender} onChange={set("gender")}><option value="">—</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select>
      </Field>
      <Field label="Date of birth"><input className="input" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
      <Field label="Address" className="sm:col-span-2"><textarea className="input" rows={2} value={f.address} onChange={set("address")} /></Field>
      <Field label="Emergency contact" className="sm:col-span-2"><input className="input" value={f.emergencyContact} onChange={set("emergencyContact")} placeholder="Name and phone" /></Field>
      <Field label="Administrative notes" hint="Non-clinical only (e.g. preferred contact time). Clinical notes go in the restricted Clinical notes tab." className="sm:col-span-2">
        <textarea className="input" rows={2} value={f.adminNotes} onChange={set("adminNotes")} />
      </Field>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="mt-1 accent-teal-600" checked={f.consentRecorded} onChange={(e) => setF({ ...f, consentRecorded: e.target.checked })} />
        Patient has consented to the clinic storing these details for treatment and billing.
      </label>
      <div className="sm:col-span-2"><ErrorNote error={err} /></div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>{initial ? "Save changes" : "Create patient"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export function PatientsPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => (setDebounced(q), setPage(0)), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading } = useLoad(() => get<{ total: number; items: Patient[] }>(`/patients?q=${encodeURIComponent(debounced)}&limit=50&offset=${page * 50}`), [debounced, page]);
  const creating = params.get("new") === "1";

  return (
    <div>
      <PageTitle title="Patients" subtitle={data ? `${data.total} patient${data.total === 1 ? "" : "s"}` : " "} actions={can("patients.write") && <Button onClick={() => setParams({ new: "1" })}><UserPlus className="h-4 w-4" /> New patient</Button>} />
      <div className="card overflow-hidden">
        <div className="border-b border-line p-4">
          <label className="relative block">
            <span className="sr-only">Search patients</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input autoFocus className="input pl-9" placeholder="Search by name, phone, patient ID or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {data && data.items.length === 0 ? (
          <Empty icon={<Users className="h-5 w-5" />} title={debounced ? "No patients match your search" : "No patients yet"}>{!debounced && "Create your first patient to start billing."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Patient</th><th>ID</th><th>Phone</th><th>Last invoice</th><th className="text-right">Outstanding</th></tr></thead>
              <tbody className={loading ? "opacity-60" : ""}>
                {data?.items.map((p) => (
                  <tr key={p.id} className="row-link" onClick={() => nav(`/patients/${p.id}`)}>
                    <td className="font-medium text-navy-900">{p.name}</td>
                    <td className="text-muted">{p.patientCode}</td>
                    <td>{p.phone ?? "—"}</td>
                    <td>{fmtDate(p.lastInvoice)}</td>
                    <td className={`num text-right ${p.outstanding ? "font-semibold text-rose-700" : "text-muted"}`}>{money(p.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 50 && (
          <div className="flex items-center justify-end gap-2 p-4 text-sm">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-muted">Page {page + 1} of {Math.ceil(data.total / 50)}</span>
            <Button size="sm" variant="secondary" disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>
      <Modal open={creating} onClose={() => setParams({})} title="New patient" wide>
        <PatientForm onCancel={() => setParams({})} onSaved={(id) => nav(`/patients/${id}`)} />
      </Modal>
    </div>
  );
}

type Detail = {
  patient: Patient;
  invoices: { id: number; invoice_no: string; invoice_date: string; total: number; paid: number; status: string }[];
  payments: { id: number; receipt_no: string; amount: number; method: string; paid_on: string; invoice_no: string }[];
  appointments: { id: number; date: string; time: string; visit_type: "clinic" | "home"; status: string; physiotherapist: string | null; notes: string | null; patient_id: number }[];
  totals: { billed: number; paid: number; outstanding: number };
};

export function PatientDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const { data, error, reload } = useLoad(() => get<Detail>(`/patients/${id}`), [id]);
  const [tab, setTab] = useState<"billing" | "appointments" | "clinical">("billing");
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [detailedBill, setDetailedBill] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <p className="text-muted">Loading…</p>;
  const p = data.patient;
  const completedSessions = data.appointments.filter((a) => a.status === "completed");
  const upcomingSessions = data.appointments.filter((a) => a.status === "confirmed" || a.status === "requested");

  async function exportData() {
    const blob = new Blob([JSON.stringify(await get(`/patients/${p.id}/export`), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.patientCode}-data-export.json`;
    a.click();
    toast("Patient data exported");
  }
  async function doDelete() {
    setDelErr(null);
    try {
      const r = await del<{ mode: string }>(`/patients/${p.id}`, { reason });
      toast(r.mode === "deleted" ? "Patient deleted" : "Patient record anonymised");
      if (r.mode === "deleted") nav("/patients");
      else (setDeleting(false), reload());
    } catch (e) {
      setDelErr((e as Error).message);
    }
  }

  return (
    <div>
      <Link to="/patients" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" /> Patients</Link>
      <PageTitle
        title={p.name}
        subtitle={<>{p.patientCode} · Registered {fmtDate(p.createdAt)}{p.anonymisedAt && <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs">Anonymised {fmtDate(p.anonymisedAt)}</span>}</>}
        actions={!p.anonymisedAt && <>
          {can("patients.write") && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
          {can("appointments.write") && <Button variant="secondary" onClick={() => setBooking(true)}><CalendarPlus className="h-4 w-4" /> Book session</Button>}
          {can("invoices.read") && <Button variant="secondary" onClick={() => setDetailedBill(true)}><FileText className="h-4 w-4" /> Detailed bill (insurance)</Button>}
          {can("invoices.write") && <Button onClick={() => nav(`/invoices/new?patient=${p.id}`)}><FilePlus2 className="h-4 w-4" /> New invoice</Button>}
        </>}
      />

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="card grid grid-cols-3 divide-x divide-line text-center">
            <div className="p-4"><p className="text-xs text-muted">Billed</p><p className="num mt-1 font-semibold">{money(data.totals.billed)}</p></div>
            <div className="p-4"><p className="text-xs text-muted">Paid</p><p className="num mt-1 font-semibold text-teal-700">{money(data.totals.paid)}</p></div>
            <div className="p-4"><p className="text-xs text-muted">Due</p><p className={`num mt-1 font-semibold ${data.totals.outstanding ? "text-rose-700" : ""}`}>{money(data.totals.outstanding)}</p></div>
          </div>
          <div className="card p-4 text-sm">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Physiotherapy sessions</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-teal-50/80 p-3">
                <p className="num font-display text-2xl text-teal-800">{completedSessions.length}</p>
                <p className="text-xs text-muted">Completed</p>
              </div>
              <div className="rounded-xl bg-cream p-3">
                <p className="num font-display text-2xl text-navy-900">{upcomingSessions.length}</p>
                <p className="text-xs text-muted">Scheduled</p>
              </div>
            </div>
            {completedSessions[0] && (
              <p className="mt-2.5 text-xs text-muted">
                Last session: <span className="font-medium text-navy-900">{fmtDate(completedSessions[0].date)}</span> ({completedSessions[0].visit_type})
              </p>
            )}
          </div>
          <div className="card p-5 text-sm">
            <dl className="space-y-3">
              {[["Mobile", p.phone], ["Email", p.email], ["Gender", p.gender], ["Date of birth", fmtDate(p.dateOfBirth)], ["Address", p.address], ["Emergency contact", p.emergencyContact], ["Admin notes", p.adminNotes]].map(([k, v]) => (
                <div key={k}><dt className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</dt><dd className="mt-0.5 whitespace-pre-wrap text-navy-900">{v || "—"}</dd></div>
              ))}
              <div><dt className="text-xs font-semibold tracking-wide text-muted uppercase">Consent</dt><dd className="mt-0.5">{p.consentRecordedAt ? `Recorded ${fmtDate(p.consentRecordedAt)}` : <span className="text-amber-700">Not recorded</span>}</dd></div>
            </dl>
          </div>
          {can("patients.delete") && (
            <div className="card space-y-2 p-5">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Data rights (admin)</p>
              <Button variant="secondary" size="sm" className="w-full" onClick={exportData}><Download className="h-4 w-4" /> Export patient data</Button>
              {!p.anonymisedAt && <Button variant="ghost" size="sm" className="w-full !text-rose-700" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" /> Delete / anonymise</Button>}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b border-line p-2" role="tablist">
            {(["billing", "appointments", ...(can("clinical.read") ? ["clinical"] : [])] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t as typeof tab)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === t ? "bg-teal-50 text-teal-800" : "text-muted hover:text-navy-900"}`}>
                {t === "clinical" ? <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Treatment &amp; clinical notes</span> : t === "billing" ? "Billing history" : "Sessions & appointments"}
              </button>
            ))}
          </div>
          {tab === "billing" && (
            <div>
              {data.invoices.length === 0 ? <Empty title="No invoices yet" /> : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead><tr><th>Invoice</th><th>Date</th><th className="text-right">Total</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
                    <tbody>{data.invoices.map((i) => (
                      <tr key={i.id} className="row-link" onClick={() => nav(`/invoices/${i.id}`)}>
                        <td className="font-medium">{i.invoice_no}</td><td>{fmtDate(i.invoice_date)}</td><td className="num text-right">{money(i.total)}</td><td className="num text-right">{money(i.paid)}</td><td><StatusBadge status={i.status} /></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {data.payments.length > 0 && (
                <>
                  <h3 className="px-4 pt-6 pb-2 text-sm font-semibold">Payments</h3>
                  <div className="overflow-x-auto">
                    <table className="table"><tbody>{data.payments.map((pay) => (
                      <tr key={pay.id} className="row-link" onClick={() => nav(`/receipts/${pay.id}`)}>
                        <td className="font-medium">{pay.receipt_no}</td><td className="text-muted">for {pay.invoice_no}</td><td>{pay.method}</td><td>{fmtDate(pay.paid_on)}</td><td className="num text-right font-semibold">{money(pay.amount)}</td>
                      </tr>
                    ))}</tbody></table>
                  </div>
                </>
              )}
            </div>
          )}
          {tab === "appointments" && (data.appointments.length === 0 ? <Empty title="No sessions recorded" /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Physiotherapist</th><th>Notes</th><th>Status</th></tr></thead>
                <tbody>{data.appointments.map((a) => (
                  <tr key={a.id}><td>{fmtDate(a.date)}</td><td>{a.time}</td><td className="capitalize">{a.visit_type}</td><td>{a.physiotherapist ?? "—"}</td><td className="text-muted">{a.notes ?? "—"}</td><td><StatusBadge status={a.status} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          ))}
          {tab === "clinical" && <ClinicalNotes patientId={p.id} readOnly={!!p.anonymisedAt || !can("clinical.write")} />}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit patient" wide>
        <PatientForm initial={p} onCancel={() => setEditing(false)} onSaved={() => (setEditing(false), reload(), toast("Patient updated"))} />
      </Modal>
      <Modal open={booking} onClose={() => setBooking(false)} title="New appointment">
        <AppointmentForm patient={{ id: p.id, name: p.name }} onDone={() => (setBooking(false), reload(), toast("Appointment saved"))} onCancel={() => setBooking(false)} />
      </Modal>
      <Modal open={detailedBill} onClose={() => setDetailedBill(false)} title="Detailed physiotherapy bill (for insurance reimbursement)" wide>
        {detailedBill && <DetailedBillForm patient={p} sessions={completedSessions} lastBillNo={data.invoices[0]?.invoice_no ?? ""} onDone={() => (setDetailedBill(false), toast("Detailed bill downloaded"))} />}
      </Modal>
      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete patient record">
        <div className="space-y-4 text-sm">
          <p>{data.invoices.length > 0
            ? "This patient has invoices, which must be kept for your financial records. Their name, contact details, address and clinical notes will be permanently erased, and invoices will show an anonymised name."
            : "This patient has no invoices. The record and all appointments and clinical notes will be permanently deleted."}</p>
          <Field label="Reason (recorded in the audit log)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient requested erasure" /></Field>
          <ErrorNote error={delErr} />
          <div className="flex gap-2"><Button variant="danger" onClick={doDelete} disabled={reason.trim().length < 5}>Permanently {data.invoices.length ? "anonymise" : "delete"}</Button><Button variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button></div>
        </div>
      </Modal>
    </div>
  );
}

function ClinicalNotes({ patientId, readOnly }: { patientId: number; readOnly: boolean }) {
  const { data, reload } = useLoad(() => get<{ id: number; note: string; created_at: string; author: string | null }[]>(`/patients/${patientId}/notes`), [patientId]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await post(`/patients/${patientId}/notes`, { note }).finally(() => setBusy(false));
    setNote("");
    reload();
  }
  return (
    <div className="p-5">
      <p className="mb-4 flex items-center gap-2 rounded-xl bg-cream p-3 text-xs text-muted"><Lock className="h-3.5 w-3.5" /> Visible only to admins and physiotherapists. Every view is recorded in the audit log.</p>
      {!readOnly && (
        <form onSubmit={add} className="mb-6 space-y-2">
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a treatment note…" required />
          <Button size="sm" loading={busy}>Add note</Button>
        </form>
      )}
      {data?.length === 0 && <Empty title="No clinical notes" />}
      <ol className="space-y-4">
        {data?.map((n) => (
          <li key={n.id} className="border-l-2 border-teal-200 pl-4">
            <p className="text-xs text-muted">{fmtDateTime(n.created_at)} · {n.author ?? "Unknown"}</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{n.note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ageFrom(dob: string | null): string {
  if (!dob) return "";
  const d = new Date(dob + "T00:00:00");
  if (isNaN(+d)) return "";
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return String(a);
}

type BillRow = { date: string; particulars: string; amount: string };

function DetailedBillForm({ patient, sessions, lastBillNo, onDone }: { patient: Patient; sessions: { date: string }[]; lastBillNo: string; onDone: () => void }) {
  const { data: s } = useLoad(() => get<Settings>("/settings"), []);
  const age = ageFrom(patient.dateOfBirth);
  const [name, setName] = useState(patient.name);
  const [ageGender, setAgeGender] = useState([age, patient.gender].filter(Boolean).join(" and "));
  const [referredBy, setReferredBy] = useState("");
  const [billNo, setBillNo] = useState(lastBillNo);
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState("1000");
  const [rows, setRows] = useState<BillRow[]>(() =>
    [...sessions].map((x) => x.date).sort().map((date) => ({ date, particulars: "Physiotherapy Charges", amount: "1000" })),
  );
  const [err, setErr] = useState<string | null>(null);

  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const set = (i: number, k: keyof BillRow, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  function download() {
    setErr(null);
    const clean = rows.filter((r) => r.date);
    if (!clean.length) return setErr("Add at least one session date.");
    if (!billNo.trim()) return setErr("Enter a bill number.");
    if (!s) return setErr("Clinic settings are still loading. Try again.");
    downloadDetailedBillPdf(
      {
        billNo: billNo.trim(), billDate, patientName: name.trim(), ageGender: ageGender.trim(), referredBy: referredBy.trim(),
        sessions: clean.map((r) => ({ date: r.date, particulars: r.particulars || "Physiotherapy Charges", amount: Math.round((Number(r.amount) || 0) * 100) })),
      },
      s,
      `Detailed-Bill-${billNo.trim().replace(/[^\w-]+/g, "_")}-${patient.patientCode}.pdf`,
    );
    onDone();
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="rounded-xl bg-teal-50/80 p-3 text-xs text-teal-900">
        A session-by-session statement patients can attach to an insurance reimbursement claim. It is pre-filled from this patient's completed sessions; check and edit before downloading.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name of the patient"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Age and gender"><input className="input" value={ageGender} onChange={(e) => setAgeGender(e.target.value)} placeholder="e.g. 32 and Female" /></Field>
        <Field label="Referred by"><input className="input" value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="e.g. Dr. name of referring doctor" /></Field>
        <Field label="Bill no."><input className="input" value={billNo} onChange={(e) => setBillNo(e.target.value)} /></Field>
        <Field label="Bill date"><input className="input" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
        <Field label="Charge per session (₹)" hint="Applies to all rows">
          <div className="flex gap-2">
            <input className="input" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} />
            <Button variant="secondary" size="sm" type="button" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, amount: rate })))}>Apply</Button>
          </div>
        </Field>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-left">
          <thead className="bg-cream text-xs text-muted uppercase">
            <tr><th className="p-2">#</th><th className="p-2">Date</th><th className="p-2">Particulars</th><th className="p-2 text-right">Amount (₹)</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="p-2 text-muted">{i + 1}</td>
                <td className="p-1.5"><input className="input !py-1.5" type="date" value={r.date} onChange={(e) => set(i, "date", e.target.value)} /></td>
                <td className="p-1.5"><input className="input !py-1.5" value={r.particulars} onChange={(e) => set(i, "particulars", e.target.value)} /></td>
                <td className="p-1.5"><input className="input num !py-1.5 text-right" inputMode="numeric" value={r.amount} onChange={(e) => set(i, "amount", e.target.value)} /></td>
                <td className="p-1.5"><button type="button" aria-label="Remove row" className="rounded p-1 text-muted hover:text-rose-700" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" type="button" onClick={() => setRows((rs) => [...rs, { date: "", particulars: "Physiotherapy Charges", amount: rate }])}><Plus className="h-4 w-4" /> Add session</Button>
        <p className="font-semibold text-navy-900">Total {rows.length} sessions · <span className="num">{money(Math.round(total * 100))}</span></p>
      </div>
      <ErrorNote error={err} />
      <Button onClick={download}><Download className="h-4 w-4" /> Download detailed bill (PDF)</Button>
    </div>
  );
}
