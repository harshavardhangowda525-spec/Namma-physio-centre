import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { SessionUser } from "../../shared/types";
import { IS_DEMO, post } from "../api";
import { useAuth } from "../auth";
import { Button, ErrorNote, Field, Logo } from "../ui";

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-80" style={{ background: "radial-gradient(60% 50% at 20% 10%, rgb(22 151 141 / .35), transparent 70%), radial-gradient(50% 50% at 90% 90%, rgb(92 200 224 / .2), transparent 70%)" }} />
        <div className="relative"><Logo light /></div>
        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-4xl leading-tight text-white">Private clinic billing, on this computer only.</h2>
          <p className="mt-4 text-white/70">Patient and billing records stay on this laptop. Nothing is uploaded to the website or the internet.</p>
          <p className="mt-8 flex items-center gap-2 text-sm text-teal-200"><ShieldCheck className="h-4 w-4" /> Works offline · Encrypted backups · Role-based access</p>
        </div>
      </div>
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { setUser, clinicName } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      setUser((await post<{ user: SessionUser }>("/auth/login", { username: u, password: p })).user);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function quickDemo(username: string) {
    setBusy(true);
    try {
      setUser((await post<{ user: SessionUser }>("/auth/login", { username, password: "demo" })).user);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Welcome back" subtitle={`Sign in to ${clinicName} billing.`}>
      {IS_DEMO && (
        <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50/80 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-teal-800 uppercase">
            <Sparkles className="h-3.5 w-3.5" /> Instant Demo Access
          </p>
          <p className="mt-1 text-xs text-muted">Click a role below to explore the billing preview with fictional sample data:</p>
          <div className="mt-3 grid gap-2">
            <Button type="button" size="sm" loading={busy} onClick={() => quickDemo("dr.sunil")} className="w-full">
              Enter as Dr. Sunil Kumar (Admin)
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => quickDemo("dr.kavitha")}>
                Physiotherapist
              </Button>
              <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => quickDemo("reception")}>
                Reception
              </Button>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username"><input className="input" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required autoFocus={!IS_DEMO} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></Field>
        <ErrorNote error={err} />
        <Button type="submit" loading={busy} className="w-full"><KeyRound className="h-4 w-4" /> Sign in</Button>
      </form>
    </Shell>
  );
}

export function SetupPage() {
  const { setUser, refresh } = useAuth();
  const [f, setF] = useState({ username: "", displayName: "Dr. Sunil Kumar", password: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setErr("Passwords do not match");
    setBusy(true);
    setErr(null);
    try {
      setUser((await post<{ user: SessionUser }>("/auth/setup", f)).user);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Set up your clinic" subtitle="Create the administrator account. You'll use it to manage staff, settings and backups.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name"><input className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required /></Field>
        <Field label="Username" hint="Letters, numbers, dots or dashes"><input className="input" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></Field>
        <Field label="Password" hint="At least 10 characters with letters and numbers"><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
        <Field label="Confirm password"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></Field>
        <ErrorNote error={err} />
        <Button type="submit" loading={busy} className="w-full">Create administrator</Button>
        <p className="text-xs text-muted">There is no password recovery service. Keep this password somewhere safe; another admin can reset staff passwords.</p>
      </form>
    </Shell>
  );
}

export function ChangePasswordPage({ forced }: { forced?: boolean }) {
  const { setUser, user, logout } = useAuth();
  const [f, setF] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return setErr("New passwords do not match");
    setBusy(true);
    setErr(null);
    try {
      await post("/auth/change-password", f);
      setOk(true);
      if (user) setUser({ ...user, mustChangePassword: false });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const form = (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required /></Field>
      <Field label="New password" hint="At least 10 characters with letters and numbers"><input className="input" type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required /></Field>
      <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required /></Field>
      <ErrorNote error={err} />
      {ok && <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">Password changed. Other sessions have been signed out.</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>Change password</Button>
        {forced && <Button type="button" variant="ghost" onClick={logout}>Sign out</Button>}
      </div>
    </form>
  );
  if (forced) return <Shell title="Choose a new password" subtitle="You signed in with a temporary password. Please set your own to continue.">{form}</Shell>;
  return <div className="card max-w-md p-6">{form}</div>;
}
