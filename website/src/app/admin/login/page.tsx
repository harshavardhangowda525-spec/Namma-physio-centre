import { redirect } from "next/navigation";
import { isAdmin, adminConfigured } from "@/lib/admin-auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <section className="container-px grid place-items-center">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-3xl">Clinic admin</h1>
        <p className="mt-2 text-sm text-muted">Manage website appointment requests.</p>
        {!adminConfigured() ? (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Admin access is not configured. Set <code>ADMIN_PASSWORD_HASH</code> and <code>ADMIN_SESSION_SECRET</code> on the server.
          </p>
        ) : (
          <LoginForm />
        )}
      </div>
    </section>
  );
}
