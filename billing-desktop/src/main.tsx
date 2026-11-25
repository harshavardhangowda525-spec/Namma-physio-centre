import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router";
import "./styles.css";
import { AuthProvider, useAuth } from "./auth";
import { Layout } from "./layout";
import { ChangePasswordPage, LoginPage, SetupPage } from "./pages/login";
import { DashboardPage } from "./pages/dashboard";
import { PatientsPage, PatientDetailPage } from "./pages/patients";
import { InvoicesPage } from "./pages/invoices";
import { InvoiceEditorPage } from "./pages/invoice-editor";
import { InvoiceViewPage, ReceiptViewPage } from "./pages/invoice-view";
import { AppointmentsPage } from "./pages/appointments";
import { AppointmentInquiriesPage } from "./pages/inquiries";
import { ReportsPage } from "./pages/reports";
import { SettingsPage } from "./pages/settings";
import { ToastProvider } from "./ui";

function Gate() {
  const { ready, user, needsSetup } = useAuth();
  if (!ready) return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>;
  if (needsSetup) return <SetupPage />;
  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <ChangePasswordPage forced />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<InvoiceEditorPage />} />
        <Route path="invoices/:id/edit" element={<InvoiceEditorPage />} />
        <Route path="invoices/:id" element={<InvoiceViewPage />} />
        <Route path="receipts/:id" element={<ReceiptViewPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="inquiries" element={<AppointmentInquiriesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
