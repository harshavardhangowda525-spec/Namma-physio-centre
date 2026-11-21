import { BarChart3, CalendarDays, FileText, LayoutDashboard, LogOut, Settings, Users, WifiOff } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "./auth";
import { Logo } from "./ui";

export function Layout() {
  const { user, logout, can } = useAuth();
  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/patients", label: "Patients", icon: Users, show: can("patients.read") },
    { to: "/invoices", label: "Invoices", icon: FileText, show: can("invoices.read") },
    { to: "/appointments", label: "Appointments", icon: CalendarDays, show: can("appointments.read") },
    { to: "/reports", label: "Reports", icon: BarChart3, show: can("reports.read") },
    { to: "/settings", label: "Settings", icon: Settings, show: true },
  ];
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-ivory px-4 py-6">
        <div className="px-2"><Logo /></div>
        <nav className="mt-8 grid gap-1" aria-label="Main">
          {nav.filter((n) => n.show).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-navy-900 text-white shadow-sm" : "text-navy-800 hover:bg-teal-50 hover:text-teal-700"}`}>
              <n.icon className="h-[18px] w-[18px]" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <p className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-800"><WifiOff className="h-3.5 w-3.5" /> Local &amp; offline · 127.0.0.1</p>
          <div className="rounded-xl border border-line bg-white p-3">
            <p className="truncate text-sm font-semibold text-navy-900">{user?.displayName}</p>
            <p className="text-xs text-muted capitalize">{user?.role}</p>
            <button onClick={logout} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8"><Outlet /></main>
    </div>
  );
}
