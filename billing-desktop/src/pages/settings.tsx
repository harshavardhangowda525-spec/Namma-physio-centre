import { AlertTriangle, CheckCircle2, FolderOpen, HardDrive, Plus, RotateCcw, ShieldCheck, Upload, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { formatDocNumber, financialYear } from "../../shared/billing";
import type { Settings } from "../../server/settings";
import { get, post, put } from "../api";
import { useAuth } from "../auth";
import { ChangePasswordPage } from "./login";
import { Button, Empty, ErrorNote, Field, Modal, MoneyInput, PageTitle, fmtDateTime, money, todayLocal, useLoad, useToast } from "../ui";

type Tab = "clinic" | "invoice" | "catalogue" | "users" | "backups" | "audit" | "privacy" | "account";

export function SettingsPage() {
  const { can } = useAuth();
  const admin = can("settings.write");
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "clinic", label: "Clinic", show: admin },
    { id: "invoice", label: "Invoices & tax", show: admin },
    { id: "catalogue", label: "Services & payments", show: admin },
    { id: "users", label: "Staff accounts", show: can("users.manage") },
    { id: "backups", label: "Backups", show: can("backups.manage") },
    { id: "audit", label: "Audit log", show: can("audit.read") },
    { id: "privacy", label: "Privacy & data", show: admin },
    { id: "account", label: "My account", show: true },
  ];
  const visible = tabs.filter((t) => t.show);
  const [tab, setTab] = useState<Tab>(visible[0].id);

  return (
    <div>
      <PageTitle title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex flex-col gap-1" aria-label="Settings sections">
          {visible.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id} className={`rounded-xl px-3 py-2 text-left text-sm font-medium ${tab === t.id ? "bg-white text-navy-900 shadow-sm ring-1 ring-line" : "text-muted hover:text-navy-900"}`}>{t.label}</button>
          ))}
        </nav>
        <div className="min-w-0">
          {(tab === "clinic" || tab === "invoice" || tab === "catalogue" || tab === "privacy") && <SettingsForm tab={tab} />}
          {tab === "users" && <Users />}
          {tab === "backups" && <Backups />}
          {tab === "audit" && <Audit />}
          {tab === "account" && <ChangePasswordPage />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {items.map((m) => (
          <li key={m} className="flex items-center gap-1 rounded-full bg-teal-50 py-1 pr-1 pl-3 text-sm text-teal-800 ring-1 ring-teal-100">
            {m}<button type="button" aria-label={`Remove ${m}`} onClick={() => onChange(items.filter((x) => x !== m))} className="grid h-6 w-6 place-items-center rounded-full hover:bg-teal-100"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="input max-w-xs" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), v.trim() && (onChange([...items, v.trim()]), setV("")))} />
        <Button type="button" variant="secondary" onClick={() => v.trim() && (onChange([...items, v.trim()]), setV(""))}><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </div>
  );
}

function SettingsForm({ tab }: { tab: "clinic" | "invoice" | "catalogue" | "privacy" }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data } = useLoad(() => get<Settings>("/settings"), []);
  const [s, setS] = useState<Settings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(data), [data]);
  if (!s) return <p className="text-muted">Loading…</p>;
  const up = <K extends keyof Settings>(k: K, patch: Partial<Settings[K]>) => setS({ ...s, [k]: { ...(s[k] as object), ...patch } } as Settings);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      setS(await put<Settings>("/settings", s));
      await refresh();
      toast("Settings saved");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 500_000) return setErr("Logo must be under 500 KB");
    const r = new FileReader();
    r.onload = () => up("clinic", { logoDataUrl: String(r.result) });
    r.readAsDataURL(file);
  }
  const fy = financialYear(todayLocal());
  const saveBar = <div className="sticky bottom-0 flex items-center gap-3 bg-cream/90 py-4 backdrop-blur"><Button loading={busy} onClick={save}>Save changes</Button><ErrorNote error={err} /></div>;

  if (tab === "clinic")
    return (
      <div className="space-y-6">
        <Section title="Clinic details" desc="Shown on invoices and receipts.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Clinic name"><input className="input" value={s.clinic.name} onChange={(e) => up("clinic", { name: e.target.value })} /></Field>
            <Field label="Tagline"><input className="input" value={s.clinic.tagline} onChange={(e) => up("clinic", { tagline: e.target.value })} /></Field>
            <Field label="Address" className="md:col-span-2"><textarea className="input" rows={2} value={s.clinic.address} onChange={(e) => up("clinic", { address: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={s.clinic.phone} onChange={(e) => up("clinic", { phone: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={s.clinic.email} onChange={(e) => up("clinic", { email: e.target.value })} /></Field>
            <Field label="GSTIN (if registered)"><input className="input" value={s.clinic.gstin} onChange={(e) => up("clinic", { gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="Registration line (optional)" hint="e.g. registration number, shown under the address"><input className="input" value={s.clinic.registrationNote} onChange={(e) => up("clinic", { registrationNote: e.target.value })} /></Field>
          </div>
        </Section>
        <Section title="Logo" desc="PNG, JPEG or WebP under 500 KB. Square images work best.">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-line bg-cream">{s.clinic.logoDataUrl ? <img src={s.clinic.logoDataUrl} alt="Clinic logo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted">No logo</span>}</div>
            <label className="cursor-pointer"><span className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-navy-900 hover:border-teal-400"><Upload className="h-4 w-4" /> Choose image</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} /></label>
            {s.clinic.logoDataUrl && <Button variant="ghost" onClick={() => up("clinic", { logoDataUrl: null })}>Remove</Button>}
          </div>
        </Section>
        {saveBar}
      </div>
    );

  if (tab === "invoice")
    return (
      <div className="space-y-6">
        <Section title="Invoice numbering" desc={<>Next invoice will look like <b className="text-navy-900">{formatDocNumber(s.invoice.prefix, s.invoice.resetEachFinancialYear ? fy : null, 1, s.invoice.padding)}</b> (sequence shown as 1).</>}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Invoice prefix"><input className="input" value={s.invoice.prefix} onChange={(e) => up("invoice", { prefix: e.target.value })} /></Field>
            <Field label="Receipt prefix"><input className="input" value={s.invoice.receiptPrefix} onChange={(e) => up("invoice", { receiptPrefix: e.target.value })} /></Field>
            <Field label="Number of digits"><input className="input" type="number" min={3} max={8} value={s.invoice.padding} onChange={(e) => up("invoice", { padding: Number(e.target.value) })} /></Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={s.invoice.resetEachFinancialYear} onChange={(e) => up("invoice", { resetEachFinancialYear: e.target.checked })} /> Restart numbering each financial year (April–March) and include the year</label>
          <CounterReset fy={s.invoice.resetEachFinancialYear ? fy : "all"} />
        </Section>
        <Section title="Tax" desc="Many physiotherapy services are exempt from GST. Confirm with your accountant before enabling tax.">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="accent-teal-600" checked={s.tax.enabled} onChange={(e) => up("tax", { enabled: e.target.checked })} /> Enable tax on invoices</label>
          {s.tax.enabled && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Tax label"><input className="input" value={s.tax.label} onChange={(e) => up("tax", { label: e.target.value })} /></Field>
              <Field label="Default rate for taxable services (%)"><input className="input" type="number" min={0} max={50} step="0.5" value={s.tax.defaultRateBp / 100} onChange={(e) => up("tax", { defaultRateBp: Math.round(Number(e.target.value) * 100) })} /></Field>
              <Field label="Tax note on invoice" className="md:col-span-3"><input className="input" value={s.tax.note} onChange={(e) => up("tax", { note: e.target.value })} /></Field>
            </div>
          )}
        </Section>
        <Section title="Layout">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Default format"><select className="input" value={s.invoice.defaultFormat} onChange={(e) => up("invoice", { defaultFormat: e.target.value as "a4" | "receipt" })}><option value="a4">A4</option><option value="receipt">Compact receipt (80mm)</option></select></Field>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal-600" checked={s.invoice.showSignature} onChange={(e) => up("invoice", { showSignature: e.target.checked })} /> Show authorised signature area</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal-600" checked={s.invoice.showStamp} onChange={(e) => up("invoice", { showStamp: e.target.checked })} /> Show clinic stamp area</label>
            </div>
            <Field label="Footer note" className="md:col-span-2"><input className="input" value={s.invoice.footerNote} onChange={(e) => up("invoice", { footerNote: e.target.value })} /></Field>
            <Field label="Terms" className="md:col-span-2"><textarea className="input" rows={2} value={s.invoice.terms} onChange={(e) => up("invoice", { terms: e.target.value })} /></Field>
          </div>
        </Section>
        {saveBar}
      </div>
    );

  if (tab === "privacy")
    return (
      <div className="space-y-6">
        <Section title="Where your data lives">
          <ul className="space-y-2 text-sm text-ink/85">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> All patient and billing records are stored only on this computer, in an SQLite database.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> The app only listens on 127.0.0.1, so other devices on the network and the internet cannot reach it.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> No analytics or telemetry. Nothing is sent to the public website.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> Clinical notes are visible only to admins and physiotherapists, and every view is audit-logged.</li>
          </ul>
          {window.desktop && <Button variant="secondary" className="mt-4" onClick={() => window.desktop!.openDataFolder()}><FolderOpen className="h-4 w-4" /> Open data folder</Button>}
        </Section>
        <Section title="Retention" desc="How long to keep records before reviewing them for deletion. Financial records may need to be kept for statutory periods — confirm with your accountant.">
          <Field label="Retention period (years)" className="max-w-xs"><input className="input" type="number" min={1} max={50} value={s.privacy.retentionYears} onChange={(e) => up("privacy", { retentionYears: Number(e.target.value) })} /></Field>
          <RetentionReview years={s.privacy.retentionYears} />
        </Section>
        <Section title="Patient requests" desc="To export or erase a patient's data, open the patient's page and use the Data rights panel. Patients with invoices are anonymised rather than deleted so your accounts remain complete.">
          <p className="text-sm text-muted">Each export, deletion and anonymisation is recorded in the audit log with the reason given.</p>
        </Section>
        {saveBar}
      </div>
    );

  // catalogue
  return (
    <div className="space-y-6">
      <Section title="Payment methods" desc="Methods available when recording payments."><ListEditor items={s.paymentMethods} onChange={(v) => setS({ ...s, paymentMethods: v })} placeholder="e.g. Cheque" /></Section>
      <Section title="Physiotherapists" desc="Used when assigning appointments."><ListEditor items={s.physiotherapists} onChange={(v) => setS({ ...s, physiotherapists: v })} placeholder="Name" /></Section>
      {saveBar}
      <ServicesCatalogue taxOn={s.tax.enabled} />
    </div>
  );
}

function CounterReset({ fy }: { fy: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(1);
  const [kind, setKind] = useState<"invoice" | "receipt">("invoice");
  return (
    <>
      <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpen(true)}>Set starting number…</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Set starting number">
        <div className="space-y-4 text-sm">
          <p className="text-muted">Use this when moving from a paper register, so numbering continues where you left off. Existing numbers are never reused.</p>
          <Field label="Document"><select className="input" value={kind} onChange={(e) => setKind(e.target.value as "invoice" | "receipt")}><option value="invoice">Invoices</option><option value="receipt">Receipts</option></select></Field>
          <Field label={`Next number (${fy === "all" ? "all years" : `FY ${fy}`})`}><input className="input" type="number" min={1} value={n} onChange={(e) => setN(Number(e.target.value))} /></Field>
          <Button onClick={async () => { await post("/settings/counters", { kind, scope: fy, nextNumber: n }); toast("Starting number updated"); setOpen(false); }}>Save</Button>
        </div>
      </Modal>
    </>
  );
}

function RetentionReview({ years }: { years: number }) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const iso = new Intl.DateTimeFormat("en-CA").format(cutoff);
  const { data } = useLoad(() => get<{ items: { id: number; lastInvoice: string | null; createdAt: string; anonymisedAt: string | null }[] }>("/patients?limit=500"), []);
  const due = data?.items.filter((p) => !p.anonymisedAt && (p.lastInvoice ?? p.createdAt.slice(0, 10)) < iso).length;
  return <p className="mt-3 text-sm text-muted">{due === undefined ? "Checking…" : `${due} patient record(s) have had no billing activity since ${iso} and are due for review.`}</p>;
}

type Svc = { id: number; name: string; default_price: number; taxable: number; active: number };
function ServicesCatalogue({ taxOn }: { taxOn: boolean }) {
  const toast = useToast();
  const { data, reload } = useLoad(() => get<Svc[]>("/services"), []);
  const [edit, setEdit] = useState<{ id?: number; name: string; defaultPrice: number; taxable: boolean; active: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Section title="Service catalogue" desc="Quick-pick services and default prices for invoices.">
      {data?.length === 0 && <Empty title="No services yet">Add your common services, e.g. "Physiotherapy session" or "Home visit".</Empty>}
      {data && data.length > 0 && (
        <table className="table"><thead><tr><th>Service</th><th className="text-right">Default price</th>{taxOn && <th>Taxable</th>}<th>Status</th><th /></tr></thead>
          <tbody>{data.map((s) => (
            <tr key={s.id}><td className="font-medium">{s.name}</td><td className="num text-right">{money(s.default_price)}</td>{taxOn && <td>{s.taxable ? "Yes" : "No"}</td>}<td>{s.active ? "Active" : <span className="text-muted">Hidden</span>}</td>
              <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit({ id: s.id, name: s.name, defaultPrice: s.default_price, taxable: !!s.taxable, active: !!s.active })}>Edit</Button></td></tr>
          ))}</tbody>
        </table>
      )}
      <Button variant="secondary" className="mt-4" onClick={() => setEdit({ name: "", defaultPrice: 0, taxable: false, active: true })}><Plus className="h-4 w-4" /> Add service</Button>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit service" : "Add service"}>
        {edit && (
          <div className="space-y-4">
            <Field label="Name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Default price"><MoneyInput value={edit.defaultPrice} onChange={(v) => setEdit({ ...edit, defaultPrice: v })} /></Field>
            {taxOn && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={edit.taxable} onChange={(e) => setEdit({ ...edit, taxable: e.target.checked })} /> Taxable</label>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Show in invoice picker</label>
            <ErrorNote error={err} />
            <Button onClick={async () => {
              try {
                const body = { name: edit.name, defaultPrice: edit.defaultPrice, taxable: edit.taxable, active: edit.active };
                if (edit.id) await put(`/services/${edit.id}`, body); else await post("/services", body);
                setEdit(null); setErr(null); reload(); toast("Service saved");
              } catch (e) { setErr((e as Error).message); }
            }}>Save</Button>
          </div>
        )}
      </Modal>
    </Section>
  );
}

type U = { id: number; username: string; display_name: string; role: string; active: number; must_change_password: number; last_login_at: string | null };
function Users() {
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, reload } = useLoad(() => get<U[]>("/users"), []);
  const [form, setForm] = useState<{ id?: number; username: string; displayName: string; role: string; password: string; active: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Section title="Staff accounts" desc={<>Roles: <b>Admin</b> — everything. <b>Physiotherapist</b> — patients, clinical notes, appointments, invoices. <b>Reception</b> — patients, appointments, invoices and payments; no clinical notes, reports or settings.</>}>
      <table className="table">
        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
        <tbody>{data?.map((u) => (
          <tr key={u.id}><td className="font-medium">{u.display_name}{u.id === me?.id && <span className="ml-2 text-xs text-muted">(you)</span>}</td><td>{u.username}</td><td className="capitalize">{u.role}</td><td>{fmtDateTime(u.last_login_at)}</td>
            <td>{u.active ? (u.must_change_password ? <span className="text-amber-700">Temporary password</span> : "Active") : <span className="text-muted">Disabled</span>}</td>
            <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setForm({ id: u.id, username: u.username, displayName: u.display_name, role: u.role, password: "", active: !!u.active })}>Edit</Button></td></tr>
        ))}</tbody>
      </table>
      <Button variant="secondary" className="mt-4" onClick={() => setForm({ username: "", displayName: "", role: "reception", password: "", active: true })}><Plus className="h-4 w-4" /> Add staff member</Button>
      <Modal open={!!form} onClose={() => (setForm(null), setErr(null))} title={form?.id ? "Edit staff account" : "Add staff account"}>
        {form && (
          <div className="space-y-4">
            <Field label="Name"><input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            {!form.id && <Field label="Username"><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>}
            <Field label="Role"><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="reception">Reception</option><option value="physiotherapist">Physiotherapist</option><option value="admin">Admin</option></select></Field>
            <Field label={form.id ? "Reset password (optional)" : "Temporary password"} hint="They will be asked to choose their own password when they sign in."><input className="input" type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            {form.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Account active</label>}
            <ErrorNote error={err} />
            <Button onClick={async () => {
              try {
                if (form.id) await put(`/users/${form.id}`, { displayName: form.displayName, role: form.role, active: form.active, ...(form.password ? { resetPassword: form.password } : {}) });
                else await post("/users", { username: form.username, displayName: form.displayName, role: form.role, temporaryPassword: form.password });
                setForm(null); setErr(null); reload(); toast("Account saved");
              } catch (e) { setErr((e as Error).message); }
            }}>Save</Button>
          </div>
        )}
      </Modal>
    </Section>
  );
}

type BStatus = { lastBackupAt: string | null; lastError: string | null; schedule: string; encrypt: boolean; passphraseSet: boolean; osProtectedSecrets: boolean; sameDriveOnly: boolean; destinations: { path: string; isDefault: boolean; writable: boolean }[]; dbFile: string; log: { id: number; at: string; kind: string; destination: string; ok: number; message: string | null; size: number }[] };
type BFile = { file: string; name: string; destination: string; size: number; createdAt: string; encrypted: boolean; kind: string };

function Backups() {
  const toast = useToast();
  const { data: st, reload } = useLoad(() => get<BStatus>("/backups/status"), []);
  const { data: files, reload: reloadFiles } = useLoad(() => get<BFile[]>("/backups"), []);
  const { data: settings, reload: reloadSettings } = useLoad(() => get<Settings>("/settings"), []);
  const [busy, setBusy] = useState(false);
  const [pp, setPp] = useState<{ passphrase: string; confirm: string; adminPassword: string } | null>(null);
  const [restore, setRestore] = useState<{ file: string; passphrase: string; adminPassword: string; verified?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newDest, setNewDest] = useState("");
  const refreshAll = () => (reload(), reloadFiles(), reloadSettings());

  async function saveBackupSettings(patch: Partial<Settings["backup"]>) {
    if (!settings) return;
    try {
      await put("/settings", { ...settings, backup: { ...settings.backup, ...patch } });
      refreshAll();
      toast("Backup settings saved");
    } catch (e) { toast((e as Error).message, "error"); }
  }
  async function backupNow() {
    setBusy(true);
    try {
      const r = await post<{ results: { destination: string; ok: boolean; message?: string }[] }>("/backups");
      const failed = r.results.filter((x) => !x.ok);
      toast(failed.length ? `Backup saved, but failed for: ${failed.map((f) => f.destination).join(", ")}` : `Backup saved to ${r.results.length} location(s)`, failed.length ? "error" : "ok");
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); refreshAll(); }
  }
  async function verify(file: string, passphrase?: string) {
    type V = { ok: boolean; error?: string; patients?: number; invoices?: number; payments?: number };
    const r: V = await post<V>("/backups/verify", { file, passphrase }).catch((e): V => ({ ok: false, error: (e as Error).message }));
    return r.ok ? `Verified ✓ — ${r.patients} patients, ${r.invoices} invoices, ${r.payments} payments` : `Failed: ${r.error}`;
  }
  async function uploadFile(f: File | undefined) {
    if (!f) return;
    const res = await fetch(`/api/backups/upload?name=${encodeURIComponent(f.name)}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: f });
    const j = await res.json();
    if (!res.ok) return toast(j.error, "error");
    setRestore({ file: j.file, passphrase: "", adminPassword: "" });
  }

  if (!st || !settings) return <p className="text-muted">Loading…</p>;
  const lastOk = st.lastBackupAt ? (Date.now() - new Date(st.lastBackupAt).getTime()) / 3600_000 : null;
  const healthy = lastOk !== null && lastOk < 26 && !st.lastError && !st.sameDriveOnly;

  return (
    <div className="space-y-6">
      <div className={`card flex flex-wrap items-center gap-4 p-5 ${healthy ? "" : "ring-2 ring-amber-300"}`}>
        {healthy ? <CheckCircle2 className="h-8 w-8 text-teal-600" /> : <AlertTriangle className="h-8 w-8 text-amber-600" />}
        <div className="flex-1">
          <p className="font-semibold text-navy-900">{st.lastBackupAt ? `Last backup ${fmtDateTime(st.lastBackupAt)}` : "No backup has been made yet"}</p>
          <p className="text-sm text-muted">
            {st.lastError ? `Last scheduled backup failed: ${st.lastError}` : st.sameDriveOnly ? "Backups are only on this laptop's drive. Add an external drive or USB folder below." : `Schedule: ${settings.backup.schedule === "off" ? "off" : settings.backup.schedule === "daily" ? `daily at ${settings.backup.dailyTime}` : settings.backup.schedule.replace("every", "every ")}`}
          </p>
        </div>
        <Button loading={busy} onClick={backupNow} disabled={settings.backup.encrypt && !st.passphraseSet}><HardDrive className="h-4 w-4" /> Back up now</Button>
      </div>

      <Section title="Encryption" desc="Encrypted backups can only be restored with your backup passphrase. Store it somewhere safe and separate from the laptop — without it, encrypted backups cannot be recovered.">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-600" checked={settings.backup.encrypt} onChange={(e) => saveBackupSettings({ encrypt: e.target.checked })} /> Encrypt backups (AES-256)</label>
        {settings.backup.encrypt && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className={st.passphraseSet ? "text-teal-700" : "font-semibold text-amber-700"}>{st.passphraseSet ? "Passphrase is set." : "No passphrase set — backups cannot run."}</span>
            <Button size="sm" variant="secondary" onClick={() => setPp({ passphrase: "", confirm: "", adminPassword: "" })}>{st.passphraseSet ? "Change passphrase" : "Set passphrase"}</Button>
            {!st.osProtectedSecrets && <span className="text-xs text-muted">(Development mode: the passphrase is not protected by Windows.)</span>}
          </div>
        )}
      </Section>

      <Section title="Schedule & destinations">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Automatic backups"><select className="input" value={settings.backup.schedule} onChange={(e) => saveBackupSettings({ schedule: e.target.value as Settings["backup"]["schedule"] })}><option value="off">Off</option><option value="daily">Daily</option><option value="every12h">Every 12 hours</option><option value="every6h">Every 6 hours</option></select></Field>
          {settings.backup.schedule === "daily" && <Field label="Time"><input className="input" type="time" value={settings.backup.dailyTime} onChange={(e) => saveBackupSettings({ dailyTime: e.target.value })} /></Field>}
          <Field label="Keep last"><select className="input" value={settings.backup.keep} onChange={(e) => saveBackupSettings({ keep: Number(e.target.value) })}>{[7, 14, 30, 60, 90, 180, 365].map((n) => <option key={n} value={n}>{n} backups per location</option>)}</select></Field>
        </div>
        <p className="mt-2 text-xs text-muted">Scheduled backups run while the app is open.</p>
        <ul className="mt-5 space-y-2">
          {st.destinations.map((d) => (
            <li key={d.path} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
              <HardDrive className={`h-4 w-4 ${d.writable ? "text-teal-600" : "text-rose-600"}`} />
              <span className="flex-1 truncate font-mono text-xs">{d.path}</span>
              <span className="text-xs text-muted">{d.isDefault ? "This laptop" : d.writable ? "Connected" : "Not reachable — is the drive plugged in?"}</span>
              {!d.isDefault && <Button size="sm" variant="ghost" onClick={() => saveBackupSettings({ destinations: settings.backup.destinations.filter((x) => x !== d.path) })}>Remove</Button>}
            </li>
          ))}
        </ul>
        {settings.backup.destinations.length < 4 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {window.desktop ? (
              <Button variant="secondary" onClick={async () => { const p = await window.desktop!.chooseFolder(); if (p) saveBackupSettings({ destinations: [...settings.backup.destinations, p] }); }}><FolderOpen className="h-4 w-4" /> Add external drive / folder</Button>
            ) : (
              <>
                <input className="input max-w-md font-mono text-xs" placeholder="Full folder path, e.g. E:\NammaPhysioBackups" value={newDest} onChange={(e) => setNewDest(e.target.value)} />
                <Button variant="secondary" onClick={() => newDest && (saveBackupSettings({ destinations: [...settings.backup.destinations, newDest] }), setNewDest(""))}>Add folder</Button>
              </>
            )}
          </div>
        )}
      </Section>

      <Section title="Restore" desc="Restoring replaces all current data with the backup. A safety backup of the current data is taken first.">
        <div className="flex flex-wrap gap-2">
          {window.desktop && <Button variant="secondary" onClick={async () => { const f = await window.desktop!.chooseBackupFile(); if (f) setRestore({ file: f, passphrase: "", adminPassword: "" }); }}><FolderOpen className="h-4 w-4" /> Choose backup file…</Button>}
          {!window.desktop && <label className="cursor-pointer"><span className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold"><Upload className="h-4 w-4" /> Upload backup file…</span><input type="file" accept=".npcbak" className="sr-only" onChange={(e) => uploadFile(e.target.files?.[0])} /></label>}
        </div>
        {files && files.length > 0 ? (
          <table className="table mt-4">
            <thead><tr><th>Created</th><th>Type</th><th>Location</th><th className="text-right">Size</th><th /></tr></thead>
            <tbody>{files.slice(0, 30).map((f) => (
              <tr key={f.file}>
                <td>{fmtDateTime(f.createdAt)}</td><td className="capitalize">{f.kind}{f.encrypted && " · 🔒"}</td><td className="max-w-[260px] truncate font-mono text-xs" title={f.destination}>{f.destination}</td><td className="num text-right">{(f.size / 1024).toFixed(0)} KB</td>
                <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setRestore({ file: f.file, passphrase: "", adminPassword: "" })}><RotateCcw className="h-4 w-4" /> Restore…</Button></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty title="No backups found" />}
      </Section>

      <Section title="Recent backup activity">
        <table className="table"><tbody>{st.log.map((l) => (
          <tr key={l.id}><td>{fmtDateTime(l.at)}</td><td className="capitalize">{l.kind}</td><td className="max-w-[300px] truncate font-mono text-xs">{l.destination}</td><td>{l.ok ? <span className="text-teal-700">OK</span> : <span className="text-rose-700">Failed: {l.message}</span>}</td></tr>
        ))}</tbody></table>
      </Section>

      <Modal open={!!pp} onClose={() => (setPp(null), setErr(null))} title="Backup passphrase">
        {pp && (
          <div className="space-y-4">
            <p className="text-sm text-muted">At least 12 characters. Write it down and keep it somewhere safe.</p>
            <Field label="Passphrase"><input className="input" type="password" autoComplete="new-password" value={pp.passphrase} onChange={(e) => setPp({ ...pp, passphrase: e.target.value })} /></Field>
            <Field label="Confirm passphrase"><input className="input" type="password" autoComplete="new-password" value={pp.confirm} onChange={(e) => setPp({ ...pp, confirm: e.target.value })} /></Field>
            <Field label="Your account password"><input className="input" type="password" autoComplete="current-password" value={pp.adminPassword} onChange={(e) => setPp({ ...pp, adminPassword: e.target.value })} /></Field>
            <ErrorNote error={err} />
            <Button onClick={async () => {
              if (pp.passphrase !== pp.confirm) return setErr("Passphrases do not match");
              try { await post("/backups/passphrase", { passphrase: pp.passphrase, adminPassword: pp.adminPassword }); setPp(null); setErr(null); refreshAll(); toast("Backup passphrase saved"); } catch (e) { setErr((e as Error).message); }
            }}>Save passphrase</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!restore} onClose={() => (setRestore(null), setErr(null))} title="Restore backup">
        {restore && (
          <div className="space-y-4 text-sm">
            <p className="break-all rounded-xl bg-cream p-3 font-mono text-xs">{restore.file}</p>
            <Field label="Backup passphrase (if encrypted)"><input className="input" type="password" value={restore.passphrase} onChange={(e) => setRestore({ ...restore, passphrase: e.target.value, verified: undefined })} /></Field>
            <Button variant="secondary" onClick={async () => setRestore({ ...restore, verified: await verify(restore.file, restore.passphrase) })}>Verify backup</Button>
            {restore.verified && <p className={restore.verified.startsWith("Verified") ? "text-teal-700" : "text-rose-700"}>{restore.verified}</p>}
            <p className="rounded-xl bg-amber-50 p-3 text-amber-900">All current data will be replaced. Anyone else signed in will need to sign in again.</p>
            <Field label="Your account password"><input className="input" type="password" autoComplete="current-password" value={restore.adminPassword} onChange={(e) => setRestore({ ...restore, adminPassword: e.target.value })} /></Field>
            <ErrorNote error={err} />
            <Button variant="danger" disabled={!restore.verified?.startsWith("Verified") || !restore.adminPassword} onClick={async () => {
              try {
                await post("/backups/restore", { file: restore.file, passphrase: restore.passphrase || undefined, adminPassword: restore.adminPassword });
                toast("Backup restored");
                setTimeout(() => window.location.reload(), 800);
              } catch (e) { setErr((e as Error).message); }
            }}>Restore this backup</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Audit() {
  const [q, setQ] = useState("");
  const { data } = useLoad(() => get<{ id: number; at: string; username: string | null; action: string; entity: string | null; entity_id: string | null; details: string | null }[]>(`/audit?limit=300&q=${encodeURIComponent(q)}`), [q]);
  return (
    <Section title="Audit log" desc="A record of sign-ins, changes to patients, invoices, payments, settings and backups. Entries cannot be edited.">
      <input className="input mb-4 max-w-sm" placeholder="Filter by action or user, e.g. invoice.void" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
          <tbody>{data?.map((a) => (
            <tr key={a.id}><td className="whitespace-nowrap">{fmtDateTime(a.at)}</td><td>{a.username ?? "—"}</td><td className="font-mono text-xs">{a.action}</td><td className="text-xs">{a.entity}{a.entity_id && ` #${a.entity_id}`}</td><td className="max-w-[320px] truncate font-mono text-[11px] text-muted" title={a.details ?? ""}>{a.details}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </Section>
  );
}
