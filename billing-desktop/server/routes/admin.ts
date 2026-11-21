import express, { Router, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  SESSION_COOKIE, attemptLogin, audit, createSession, destroySession, destroyUserSessions, hashPassword, passwordProblem,
  requireAuth, requirePerm, verifyPassword,
} from "../auth";
import {
  BackupError, createBackup, defaultBackupDir, destinations, hasPassphrase, listBackups, restoreBackup, sameDriveOnly,
  storePassphrase, verifyBackupFile,
} from "../backup";
import type { Ctx } from "../context";
import { nowIso } from "../db";
import { getKV, getSettings, saveSettings, settingsSchema } from "../settings";
import { HttpError } from "./core";

const roleEnum = z.enum(["admin", "physiotherapist", "reception"]);
const username = z.string().trim().min(3, "Username must be at least 3 characters").max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores");

function setSessionCookie(res: Response, token: string, maxAgeMs: number) {
  // Loopback only; Secure is not applicable to http://127.0.0.1.
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", path: "/", maxAge: maxAgeMs });
}

function checkPassword(pw: string) {
  const p = passwordProblem(pw);
  if (p) throw new HttpError(400, p);
}

export function authRoutes(ctx: Ctx) {
  const r = Router();
  const userCount = () => (ctx.db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c;

  r.get("/auth/status", (req, res) => {
    res.json({ needsSetup: userCount() === 0, user: req.user ?? null, clinicName: getSettings(ctx.db).clinic.name });
  });

  /** First-run: create the clinic admin account. Only works while no users exist. */
  r.post("/auth/setup", async (req, res) => {
    if (userCount() > 0) throw new HttpError(409, "Setup has already been completed");
    const d = z.object({ username, displayName: z.string().trim().min(2).max(80), password: z.string() }).parse(req.body);
    checkPassword(d.password);
    const hash = await hashPassword(d.password);
    const info = ctx.db.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, 'admin')").run(d.username, d.displayName, hash);
    const user = { id: Number(info.lastInsertRowid), username: d.username, displayName: d.displayName, role: "admin" as const, mustChangePassword: false };
    audit(ctx.db, user, "auth.setup", "user", user.id);
    const s = createSession(ctx.db, user.id);
    setSessionCookie(res, s.token, s.maxAgeMs);
    res.status(201).json({ user });
  });

  r.post("/auth/login", async (req, res) => {
    const d = z.object({ username: z.string().trim().min(1), password: z.string().min(1) }).parse(req.body);
    const result = await attemptLogin(ctx.db, d.username, d.password);
    if (!result.ok) throw new HttpError(401, result.error);
    const s = createSession(ctx.db, result.user.id);
    setSessionCookie(res, s.token, s.maxAgeMs);
    audit(ctx.db, result.user, "auth.login", "user", result.user.id);
    res.json({ user: result.user });
  });

  r.post("/auth/logout", (req, res) => {
    destroySession(ctx.db, req.sessionToken);
    if (req.user) audit(ctx.db, req.user, "auth.logout", "user", req.user.id);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  r.post("/auth/change-password", requireAuth, async (req, res) => {
    const d = z.object({ currentPassword: z.string(), newPassword: z.string() }).parse(req.body);
    const row = ctx.db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user!.id) as { password_hash: string };
    if (!(await verifyPassword(d.currentPassword, row.password_hash))) throw new HttpError(400, "Current password is incorrect");
    checkPassword(d.newPassword);
    if (d.newPassword === d.currentPassword) throw new HttpError(400, "Choose a different password");
    ctx.db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(await hashPassword(d.newPassword), req.user!.id);
    destroyUserSessions(ctx.db, req.user!.id, req.sessionToken);
    audit(ctx.db, req.user!, "auth.change_password", "user", req.user!.id);
    res.json({ ok: true });
  });

  return r;
}

export function adminRoutes(ctx: Ctx) {
  const r = Router();

  // ---------- settings ----------
  r.get("/settings", (_req, res) => res.json(getSettings(ctx.db)));
  r.put("/settings", requirePerm("settings.write"), (req, res) => {
    const s = settingsSchema.parse(req.body);
    s.paymentMethods = [...new Set(s.paymentMethods.map((m) => m.trim()).filter(Boolean))];
    if (s.clinic.logoDataUrl && !/^data:image\/(png|jpeg|webp);base64,/.test(s.clinic.logoDataUrl)) throw new HttpError(400, "Logo must be a PNG, JPEG or WebP image");
    for (const d of s.backup.destinations) if (d && !path.isAbsolute(d)) throw new HttpError(400, `Backup folder must be a full path: ${d}`);
    saveSettings(ctx.db, s);
    audit(ctx.db, req.user!, "settings.update", "settings", null);
    res.json(s);
  });

  /** Sets the invoice/receipt counter (e.g. when migrating from a paper register). */
  r.post("/settings/counters", requirePerm("settings.write"), (req, res) => {
    const d = z.object({ kind: z.enum(["invoice", "receipt"]), scope: z.string().regex(/^(all|\d{4}-\d{2})$/), nextNumber: z.number().int().min(1).max(9_999_999) }).parse(req.body);
    const key = `seq:${d.kind}:${d.scope}`;
    ctx.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(d.nextNumber - 1));
    audit(ctx.db, req.user!, "settings.counter", "settings", key, d);
    res.json({ ok: true });
  });

  // ---------- users ----------
  r.get("/users", requirePerm("users.manage"), (_req, res) => {
    res.json(ctx.db.prepare("SELECT id, username, display_name, role, active, must_change_password, last_login_at, created_at FROM users ORDER BY id").all());
  });
  r.post("/users", requirePerm("users.manage"), async (req, res) => {
    const d = z.object({ username, displayName: z.string().trim().min(2).max(80), role: roleEnum, temporaryPassword: z.string() }).parse(req.body);
    checkPassword(d.temporaryPassword);
    if (ctx.db.prepare("SELECT 1 FROM users WHERE username = ?").get(d.username)) throw new HttpError(409, "That username is taken");
    const info = ctx.db
      .prepare("INSERT INTO users (username, display_name, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)")
      .run(d.username, d.displayName, await hashPassword(d.temporaryPassword), d.role);
    audit(ctx.db, req.user!, "user.create", "user", Number(info.lastInsertRowid), { username: d.username, role: d.role });
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });
  r.put("/users/:id", requirePerm("users.manage"), async (req, res) => {
    const uid = Number(req.params.id);
    const d = z.object({ displayName: z.string().trim().min(2).max(80), role: roleEnum, active: z.boolean(), resetPassword: z.string().optional() }).parse(req.body);
    const target = ctx.db.prepare("SELECT role, active FROM users WHERE id = ?").get(uid) as { role: string; active: number } | undefined;
    if (!target) throw new HttpError(404, "User not found");
    const otherAdmins = (ctx.db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin' AND active=1 AND id != ?").get(uid) as { c: number }).c;
    if (target.role === "admin" && (d.role !== "admin" || !d.active) && otherAdmins === 0) throw new HttpError(409, "At least one active admin account is required");
    ctx.db.prepare("UPDATE users SET display_name = ?, role = ?, active = ? WHERE id = ?").run(d.displayName, d.role, d.active ? 1 : 0, uid);
    if (d.resetPassword) {
      checkPassword(d.resetPassword);
      ctx.db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?").run(await hashPassword(d.resetPassword), uid);
    }
    if (!d.active || d.resetPassword) destroyUserSessions(ctx.db, uid);
    audit(ctx.db, req.user!, "user.update", "user", uid, { role: d.role, active: d.active, passwordReset: !!d.resetPassword });
    res.json({ ok: true });
  });

  // ---------- audit ----------
  r.get("/audit", requirePerm("audit.read"), (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const q = String(req.query.q ?? "").trim();
    const rows = q
      ? ctx.db.prepare("SELECT * FROM audit_log WHERE action LIKE ? OR username LIKE ? OR entity_id = ? ORDER BY id DESC LIMIT ? OFFSET ?").all(`%${q}%`, `%${q}%`, q, limit, offset)
      : ctx.db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?").all(limit, offset);
    res.json(rows);
  });

  // ---------- backups ----------
  r.use("/backups", requirePerm("backups.manage"));

  r.get("/backups/status", (_req, res) => {
    const s = getSettings(ctx.db);
    const dests = destinations(ctx).map((d) => {
      let writable = false;
      try {
        fs.mkdirSync(d, { recursive: true });
        fs.accessSync(d, fs.constants.W_OK);
        writable = true;
      } catch {
        /* not reachable — e.g. external drive unplugged */
      }
      return { path: d, isDefault: d === defaultBackupDir(ctx), writable };
    });
    res.json({
      lastBackupAt: getKV(ctx.db, "last_backup_at"),
      lastError: getKV(ctx.db, "last_backup_error"),
      schedule: s.backup.schedule,
      encrypt: s.backup.encrypt,
      passphraseSet: hasPassphrase(ctx),
      osProtectedSecrets: ctx.secretStore.available,
      sameDriveOnly: sameDriveOnly(ctx),
      destinations: dests,
      dbFile: ctx.dbFile,
      log: ctx.db.prepare("SELECT * FROM backup_log ORDER BY id DESC LIMIT 20").all(),
    });
  });

  r.get("/backups", (_req, res) => res.json(listBackups(ctx)));

  r.post("/backups/passphrase", async (req, res) => {
    const d = z.object({ passphrase: z.string().min(12, "Use at least 12 characters").max(200), adminPassword: z.string() }).parse(req.body);
    await confirmAdminPassword(ctx, req.user!.id, d.adminPassword);
    storePassphrase(ctx, d.passphrase);
    audit(ctx.db, req.user!, "backup.passphrase_set", "backup", null);
    res.json({ ok: true });
  });

  r.post("/backups", (req, res) => {
    try {
      const results = createBackup(ctx, "manual");
      audit(ctx.db, req.user!, "backup.create", "backup", null, results);
      res.status(results.some((x) => x.ok) ? 201 : 500).json({ results });
    } catch (e) {
      if (e instanceof BackupError) throw new HttpError(400, e.message);
      throw e;
    }
  });

  const knownBackup = (file: string) => {
    const resolved = path.resolve(file);
    if (!resolved.endsWith(".npcbak") || !fs.existsSync(resolved)) throw new HttpError(400, "Backup file not found");
    return resolved;
  };

  r.post("/backups/verify", (req, res) => {
    const d = z.object({ file: z.string(), passphrase: z.string().optional() }).parse(req.body);
    try {
      const out = verifyBackupFile(knownBackup(d.file), d.passphrase);
      audit(ctx.db, req.user!, "backup.verify", "backup", path.basename(d.file), { ok: true });
      res.json({ ok: true, ...out });
    } catch (e) {
      if (e instanceof BackupError) return void res.status(422).json({ ok: false, error: e.message });
      throw e;
    }
  });

  /** Upload a backup file (e.g. from a USB drive) into the default backup folder. */
  r.post("/backups/upload", express.raw({ type: "application/octet-stream", limit: "500mb" }), (req, res) => {
    const name = String(req.query.name ?? "uploaded.npcbak").replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!name.endsWith(".npcbak")) throw new HttpError(400, "Choose a .npcbak backup file");
    const dir = path.join(defaultBackupDir(ctx), "imported");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${name}`);
    fs.writeFileSync(file, req.body as Buffer);
    audit(ctx.db, req.user!, "backup.upload", "backup", name);
    res.status(201).json({ file });
  });

  r.post("/backups/restore", async (req, res) => {
    const d = z.object({ file: z.string(), passphrase: z.string().optional(), adminPassword: z.string() }).parse(req.body);
    await confirmAdminPassword(ctx, req.user!.id, d.adminPassword);
    const user = req.user!;
    try {
      const out = restoreBackup(ctx, knownBackup(d.file), d.passphrase);
      // The audit entry goes into the restored database.
      audit(ctx.db, user, "backup.restore", "backup", path.basename(d.file), { safetyBackup: out.safetyBackup, at: nowIso() });
      res.json({ ok: true, ...out });
    } catch (e) {
      if (e instanceof BackupError) throw new HttpError(422, e.message);
      throw e;
    }
  });

  return r;
}

async function confirmAdminPassword(ctx: Ctx, userId: number, pw: string) {
  const row = ctx.db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string };
  if (!(await verifyPassword(pw, row.password_hash))) throw new HttpError(403, "Your password is incorrect");
}
