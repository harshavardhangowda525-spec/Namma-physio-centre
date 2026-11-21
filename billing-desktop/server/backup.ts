import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { EXPECTED_TABLES, nowIso } from "./db";
import type { Ctx } from "./context";
import { getKV, getSettings, setKV } from "./settings";

/**
 * Backup file format (.npcbak):
 *   "NPCBAK1\n" | uint32 BE header length | header JSON | payload
 * payload = gzip(sqlite bytes), optionally AES-256-GCM encrypted with a key
 * derived from a passphrase via scrypt. The header stores a SHA-256 of the
 * plain database so every backup can be integrity-checked before restore.
 */
const MAGIC = Buffer.from("NPCBAK1\n");
const EXT = ".npcbak";
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type BackupHeader = {
  app: "namma-physio-billing";
  createdAt: string;
  schemaVersion: number;
  kind: string;
  encrypted: boolean;
  sha256: string;
  size: number;
  salt?: string;
  iv?: string;
  tag?: string;
};

export class BackupError extends Error {}

export function defaultBackupDir(ctx: Ctx) {
  return path.join(ctx.dataDir, "backups");
}

export function destinations(ctx: Ctx): string[] {
  const s = getSettings(ctx.db);
  return [defaultBackupDir(ctx), ...s.backup.destinations.filter(Boolean)];
}

/** True if every destination lives on the same drive as the database. */
export function sameDriveOnly(ctx: Ctx) {
  const root = (p: string) => path.parse(path.resolve(p)).root.toLowerCase();
  const dbRoot = root(ctx.dbFile);
  const ext = getSettings(ctx.db).backup.destinations.filter(Boolean);
  if (ext.length === 0) return true;
  // On POSIX every path shares "/", so treat any configured external path as separate.
  if (process.platform !== "win32") return false;
  return ext.every((d) => root(d) === dbRoot);
}

// ---------- passphrase storage (for scheduled encrypted backups) ----------
export function hasPassphrase(ctx: Ctx) {
  return !!getKV(ctx.db, "backup_passphrase");
}
export function storePassphrase(ctx: Ctx, passphrase: string | null) {
  setKV(ctx.db, "backup_passphrase", passphrase ? ctx.secretStore.encrypt(passphrase) : null);
}
function storedPassphrase(ctx: Ctx): string | null {
  const v = getKV(ctx.db, "backup_passphrase");
  return v ? ctx.secretStore.decrypt(v) : null;
}

// ---------- encode / decode ----------
export function encodeBackup(dbBytes: Buffer, opts: { kind: string; schemaVersion: number; passphrase?: string | null }): Buffer {
  const sha256 = crypto.createHash("sha256").update(dbBytes).digest("hex");
  const gz = zlib.gzipSync(dbBytes, { level: 9 });
  const header: BackupHeader = { app: "namma-physio-billing", createdAt: nowIso(), schemaVersion: opts.schemaVersion, kind: opts.kind, encrypted: !!opts.passphrase, sha256, size: dbBytes.length };
  let payload = gz;
  if (opts.passphrase) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(opts.passphrase, salt, 32, SCRYPT);
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    payload = Buffer.concat([c.update(gz), c.final()]);
    Object.assign(header, { salt: salt.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") });
  }
  const h = Buffer.from(JSON.stringify(header));
  const len = Buffer.alloc(4);
  len.writeUInt32BE(h.length);
  return Buffer.concat([MAGIC, len, h, payload]);
}

export function readHeader(buf: Buffer): { header: BackupHeader; payload: Buffer } {
  if (buf.length < MAGIC.length + 4 || !buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupError("Not a Namma Physio backup file");
  const len = buf.readUInt32BE(MAGIC.length);
  const start = MAGIC.length + 4;
  if (len > 64 * 1024 || start + len > buf.length) throw new BackupError("Backup header is damaged");
  const header = JSON.parse(buf.subarray(start, start + len).toString("utf8")) as BackupHeader;
  if (header.app !== "namma-physio-billing") throw new BackupError("Backup is from a different application");
  return { header, payload: buf.subarray(start + len) };
}

export function decodeBackup(buf: Buffer, passphrase?: string | null): { header: BackupHeader; dbBytes: Buffer } {
  const { header, payload } = readHeader(buf);
  let gz = payload;
  if (header.encrypted) {
    if (!passphrase) throw new BackupError("This backup is encrypted. Enter the backup passphrase.");
    try {
      const key = crypto.scryptSync(passphrase, Buffer.from(header.salt!, "base64"), 32, SCRYPT);
      const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(header.iv!, "base64"));
      d.setAuthTag(Buffer.from(header.tag!, "base64"));
      gz = Buffer.concat([d.update(payload), d.final()]);
    } catch {
      throw new BackupError("Wrong passphrase, or the backup file has been altered");
    }
  }
  let dbBytes: Buffer;
  try {
    dbBytes = zlib.gunzipSync(gz);
  } catch {
    throw new BackupError("Backup data is corrupted (cannot decompress)");
  }
  const sha = crypto.createHash("sha256").update(dbBytes).digest("hex");
  if (sha !== header.sha256 || dbBytes.length !== header.size) throw new BackupError("Backup failed its integrity check (checksum mismatch)");
  return { header, dbBytes };
}

/** Opens the database bytes in a temp file and runs SQLite's integrity check. */
export function verifyDatabaseBytes(dbBytes: Buffer) {
  const tmp = path.join(os.tmpdir(), `npc-verify-${crypto.randomBytes(6).toString("hex")}.db`);
  fs.writeFileSync(tmp, dbBytes);
  try {
    const db = new Database(tmp, { readonly: true, fileMustExist: true });
    try {
      const ic = db.pragma("integrity_check", { simple: true });
      if (ic !== "ok") throw new BackupError(`Database integrity check failed: ${ic}`);
      const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name);
      const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
      if (missing.length) throw new BackupError(`Backup is missing tables: ${missing.join(", ")}`);
      const count = (t: string) => (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
      return { patients: count("patients"), invoices: count("invoices"), payments: count("payments"), schemaVersion: db.pragma("user_version", { simple: true }) as number };
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ---------- operations ----------
export type BackupResult = { destination: string; ok: boolean; file?: string; message?: string };

export function createBackup(ctx: Ctx, kind: "manual" | "scheduled" | "pre-restore", passphraseOverride?: string | null): BackupResult[] {
  const s = getSettings(ctx.db);
  const passphrase = s.backup.encrypt ? passphraseOverride ?? storedPassphrase(ctx) : null;
  if (s.backup.encrypt && !passphrase) throw new BackupError("Encrypted backups are on, but no backup passphrase is set. Set one in Settings › Backups.");
  ctx.db.pragma("wal_checkpoint(TRUNCATE)");
  const dbBytes = ctx.db.serialize();
  const blob = encodeBackup(dbBytes, { kind, schemaVersion: ctx.db.pragma("user_version", { simple: true }) as number, passphrase });
  const sha = crypto.createHash("sha256").update(dbBytes).digest("hex");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = `namma-physio-${kind}-${stamp}${EXT}`;
  const dests = kind === "pre-restore" ? [defaultBackupDir(ctx)] : destinations(ctx);

  const results: BackupResult[] = dests.map((dir) => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name);
      const tmp = file + ".partial";
      fs.writeFileSync(tmp, blob);
      // Read back and verify before committing the file name.
      decodeBackup(fs.readFileSync(tmp), passphrase);
      fs.renameSync(tmp, file);
      prune(dir, s.backup.keep);
      return { destination: dir, ok: true, file };
    } catch (e) {
      return { destination: dir, ok: false, message: (e as Error).message };
    }
  });
  const log = ctx.db.prepare("INSERT INTO backup_log (kind, destination, file, size, sha256, encrypted, ok, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const r of results) log.run(kind, r.destination, r.file ?? null, blob.length, sha, passphrase ? 1 : 0, r.ok ? 1 : 0, r.message ?? null);
  if (results.some((r) => r.ok)) setKV(ctx.db, "last_backup_at", nowIso());
  return results;
}

function prune(dir: string, keep: number) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(EXT) && !f.includes("-pre-restore-"))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(keep)) fs.rmSync(path.join(dir, f), { force: true });
}

export function listBackups(ctx: Ctx) {
  const out: { file: string; name: string; destination: string; size: number; createdAt: string; encrypted: boolean; kind: string }[] = [];
  for (const dir of destinations(ctx)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(EXT)) continue;
      const file = path.join(dir, f);
      try {
        const fd = fs.openSync(file, "r");
        const head = Buffer.alloc(64 * 1024);
        const n = fs.readSync(fd, head, 0, head.length, 0);
        fs.closeSync(fd);
        const { header } = readHeader(head.subarray(0, n));
        out.push({ file, name: f, destination: dir, size: fs.statSync(file).size, createdAt: header.createdAt, encrypted: header.encrypted, kind: header.kind });
      } catch {
        /* skip unreadable files */
      }
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function verifyBackupFile(file: string, passphrase?: string | null) {
  const { header, dbBytes } = decodeBackup(fs.readFileSync(file), passphrase);
  return { header, ...verifyDatabaseBytes(dbBytes) };
}

/** Restores a verified backup. A pre-restore safety backup is always taken first. */
export function restoreBackup(ctx: Ctx, file: string, passphrase?: string | null) {
  const { dbBytes } = decodeBackup(fs.readFileSync(file), passphrase);
  const info = verifyDatabaseBytes(dbBytes);
  const safety = createBackup(ctx, "pre-restore", getSettings(ctx.db).backup.encrypt ? storedPassphrase(ctx) ?? passphrase : null);
  if (!safety.some((r) => r.ok)) throw new BackupError("Could not create a safety backup of the current data, so the restore was cancelled.");
  ctx.db.close();
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(ctx.dbFile + suffix, { force: true });
  fs.writeFileSync(ctx.dbFile, dbBytes);
  ctx.reopen();
  return { ...info, safetyBackup: safety.find((r) => r.ok)?.file };
}

// ---------- scheduler ----------
export function isDue(schedule: string, dailyTime: string, lastIso: string | null, now = new Date()): boolean {
  if (schedule === "off") return false;
  const last = lastIso ? new Date(lastIso).getTime() : 0;
  if (schedule === "every6h") return now.getTime() - last >= 6 * 3600_000;
  if (schedule === "every12h") return now.getTime() - last >= 12 * 3600_000;
  // daily: run once per local day after the configured time
  const [h, m] = dailyTime.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return now >= target && last < target.getTime();
}

export function startScheduler(ctx: Ctx, log: (msg: string) => void = console.log) {
  const tick = () => {
    try {
      const s = getSettings(ctx.db);
      if (!isDue(s.backup.schedule, s.backup.dailyTime, getKV(ctx.db, "last_backup_at"))) return;
      const r = createBackup(ctx, "scheduled");
      log(`[backup] scheduled backup: ${r.map((x) => `${x.destination}=${x.ok ? "ok" : x.message}`).join("; ")}`);
      if (!r.some((x) => x.ok)) setKV(ctx.db, "last_backup_error", r.map((x) => x.message).join("; "));
      else setKV(ctx.db, "last_backup_error", null);
    } catch (e) {
      setKV(ctx.db, "last_backup_error", (e as Error).message);
      log(`[backup] scheduled backup failed: ${(e as Error).message}`);
    }
  };
  const t = setInterval(tick, 60_000);
  t.unref?.();
  setTimeout(tick, 10_000).unref?.();
  return () => clearInterval(t);
}
