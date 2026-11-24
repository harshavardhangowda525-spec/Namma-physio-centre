import { BarChart3, CalendarDays, FileText, LayoutDashboard, LogOut, Menu, RotateCcw, Settings, Sparkles, Users, WifiOff, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import type { Role, SessionUser } from "../shared/types";
import { IS_DEMO, post } from "./api";
import { useAuth } from "./auth";
import { Logo, useToast } from "./ui";

export function Layout() {
  const { user, setUser, logout, can } = useAuth();
  const navTo = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/patients", label: "Patients", icon: Users, show: can("patients.read") },
    { to: "/invoices", label: "Invoices", icon: FileText, show: can("invoices.read") },
    { to: "/appointments", label: "Appointments", icon: CalendarDays, show: can("appointments.read") },
    { to: "/reports", label: "Reports", icon: BarChart3, show: can("reports.read") },
    { to: "/settings", label: "Settings", icon: Settings, show: true },
  ];

  async function switchRole(role: Role) {
    const r = await post<{ user: SessionUser }>("/demo/switch-role", { role });
    setUser(r.user);
    navTo("/");
    toast(`Viewing demo as ${r.user.displayName} (${role})`);
  }

  async function resetDemo() {
    const r = await post<{ user: SessionUser }>("/demo/reset");
    setUser(r.user);
    navTo("/");
    window.location.reload();
  }

  const sidebarBody = (
    <>
      <div className="flex items-center justify-between px-2">
        <Logo />
        <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="grid h-9 w-9 place-items-center rounded-lg text-navy-800 hover:bg-cream lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="mt-8 grid gap-1" aria-label="Main">
        {nav.filter((n) => n.show).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-navy-900 text-white shadow-sm" : "text-navy-800 hover:bg-teal-50 hover:text-teal-700"}`}
          >
            <n.icon className="h-[18px] w-[18px]" /> {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        {IS_DEMO ? (
          <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-800" title="In clinic installation, runs 100% offline on 127.0.0.1">
            <Sparkles className="h-3.5 w-3.5 shrink-0" /> Demo sandbox · Browser only
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-800">
            <WifiOff className="h-3.5 w-3.5 shrink-0" /> Local &amp; offline · 127.0.0.1
          </p>
        )}
        <div className="rounded-xl border border-line bg-white p-3">
          <p className="truncate text-sm font-semibold text-navy-900">{user?.displayName}</p>
          <p className="text-xs text-muted capitalize">{user?.role}</p>
          <button onClick={logout} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {IS_DEMO && (
        <div className="no-print border-b border-navy-800 bg-navy-950 px-4 py-2 text-xs text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2">
              <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-teal-200 ring-1 ring-teal-400/30 uppercase">
                Interactive Demo
              </span>
              <span className="text-white/80">Sample fictional records only — clinic installation runs privately offline on your PC.</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-white/75">
                <span className="hidden sm:inline">Preview role:</span>
                <select
                  aria-label="Preview role"
                  value={user?.role ?? "admin"}
                  onChange={(e) => switchRole(e.target.value as Role)}
                  className="rounded-lg border border-white/15 bg-navy-900 px-2.5 py-1 text-xs font-semibold text-white outline-none focus:border-teal-400"
                >
                  <option value="admin">Admin (Dr. Sunil Kumar)</option>
                  <option value="physiotherapist">Physiotherapist (Dr. Kavitha)</option>
                  <option value="reception">Reception (Ramesh Gowda)</option>
                </select>
              </label>
              <button
                type="button"
                onClick={resetDemo}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-teal-200 transition hover:bg-white/10"
              >
                <RotateCcw className="h-3 w-3" /> Reset sample data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ivory/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-navy-900 shadow-xs"
        >
          <Menu className="h-4 w-4" /> Menu
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-navy-950/40 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <aside className="relative z-10 flex h-full w-64 max-w-[82vw] flex-col border-r border-line bg-ivory px-4 py-5 shadow-2xl">
            {sidebarBody}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1">
        <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-ivory px-4 py-6 lg:flex">
          {sidebarBody}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
