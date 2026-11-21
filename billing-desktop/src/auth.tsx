import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Permission, SessionUser } from "../shared/types";
import { can } from "../shared/types";
import { get, onUnauthorised, post } from "./api";

type AuthState = {
  user: SessionUser | null;
  needsSetup: boolean;
  clinicName: string;
  ready: boolean;
  refresh: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
};
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [clinicName, setClinicName] = useState("Namma Physio Centre");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const s = await get<{ needsSetup: boolean; user: SessionUser | null; clinicName: string }>("/auth/status");
    setUser(s.user);
    setNeedsSetup(s.needsSetup);
    setClinicName(s.clinicName);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh().catch(() => setReady(true));
    return onUnauthorised(() => setUser(null));
  }, [refresh]);

  // Auto sign-out after 30 minutes of inactivity.
  useEffect(() => {
    if (!user) return;
    let t: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(() => post("/auth/logout").finally(() => setUser(null)), 30 * 60_000);
    };
    const evs = ["mousemove", "keydown", "click"] as const;
    evs.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user]);

  const logout = async () => {
    await post("/auth/logout").catch(() => {});
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, needsSetup, clinicName, ready, refresh, setUser, logout, can: (p) => can(user?.role, p) }}>
      {children}
    </Ctx.Provider>
  );
}
