import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { can, type Permission, type Role, type SessionUser } from "../shared/types";
import { nowIso, type DB } from "./db";
import type { Ctx } from "./context";

export const SESSION_COOKIE = "npb_session";
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Include both letters and numbers";
  return null;
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function createSession(db: DB, userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(sha(token), userId, nowIso(), expires);
  return { token, maxAgeMs: SESSION_HOURS * 3600_000 };
}

export function destroySession(db: DB, token: string | undefined) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

export function destroyUserSessions(db: DB, userId: number, exceptToken?: string) {
  if (exceptToken) db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(userId, sha(exceptToken));
  else db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function userForToken(db: DB, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role, u.must_change_password, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.active = 1`,
    )
    .get(sha(token)) as { id: number; username: string; display_name: string; role: Role; must_change_password: number; expires_at: string } | undefined;
  if (!row || row.expires_at < nowIso()) return null;
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, mustChangePassword: !!row.must_change_password };
}

let dummyHash: string | undefined;

type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string };

export async function attemptLogin(db: DB, username: string, password: string): Promise<LoginResult> {
  const u = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | { id: number; username: string; display_name: string; role: Role; password_hash: string; active: number; failed_attempts: number; locked_until: string | null; must_change_password: number }
    | undefined;
  // Always run bcrypt to keep timing similar for unknown users.
  dummyHash ??= bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 12);
  const hash = u?.password_hash ?? dummyHash;
  const ok = await verifyPassword(password, hash);
  if (!u || !u.active) return { ok: false, error: "Incorrect username or password" };
  if (u.locked_until && u.locked_until > nowIso()) return { ok: false, error: `Too many failed attempts. Try again after ${new Date(u.locked_until).toLocaleTimeString()}.` };
  if (!ok) {
    const fails = u.failed_attempts + 1;
    const lock = fails >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    db.prepare("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?").run(lock ? 0 : fails, lock, u.id);
    audit(db, null, "auth.login_failed", "user", u.id, { username: u.username, locked: !!lock });
    return { ok: false, error: lock ? `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.` : "Incorrect username or password" };
  }
  db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?").run(nowIso(), u.id);
  return { ok: true, user: { id: u.id, username: u.username, displayName: u.display_name, role: u.role, mustChangePassword: !!u.must_change_password } };
}

export function audit(db: DB, user: SessionUser | null, action: string, entity?: string, entityId?: number | string | null, details?: unknown) {
  db.prepare("INSERT INTO audit_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)").run(
    user?.id ?? null,
    user?.username ?? null,
    action,
    entity ?? null,
    entityId == null ? null : String(entityId),
    details === undefined ? null : JSON.stringify(details),
  );
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionToken?: string;
    }
  }
}

export function sessionMiddleware(ctx: Ctx) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const user = userForToken(ctx.db, token);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return void res.status(401).json({ error: "Please sign in" });
  // Users with a temporary password may only change it.
  if (req.user.mustChangePassword && !req.path.startsWith("/auth")) return void res.status(403).json({ error: "Please change your temporary password first", code: "MUST_CHANGE_PASSWORD" });
  next();
}

export function requirePerm(p: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!can(req.user?.role, p)) return void res.status(403).json({ error: "You don't have permission to do that" });
    next();
  };
}
