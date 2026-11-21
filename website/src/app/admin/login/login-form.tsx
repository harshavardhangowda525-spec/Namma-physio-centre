"use client";
import { useActionState } from "react";
import { login } from "../actions";
import { buttonClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
