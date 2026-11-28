import crypto from "node:crypto";
import { z } from "zod";
import type { AppointmentInquiry, InquirySyncState, InquirySyncStatus, SessionUser } from "../shared/types";
import { audit } from "./auth";
import type { Ctx } from "./context";
import { nowIso, type DB } from "./db";
import { HttpError } from "./routes/core";
import { getKV, getSettings, setKV } from "./settings";

export const DEFAULT_WEBSITE_URL = "https://namma-physio-centre-psi.vercel.app";

const KV_URL = "inquiry_sync_url";
const KV_TOKEN = "inquiry_sync_token";
const KV_CURSOR = "inquiry_sync_cursor";
const KV_LAST_SYNC = "inquiry_last_sync_at";

export const remoteInquirySchema = z.object({
  id: z.number().int().nonnegative(),
  reference: z.string().trim().min(3).max(64),
  visit_type: z.enum(["clinic", "home"]),
  patient_name: z.string().trim().min(1).max(120),
  mobile: z.string().trim().min(5).max(30),
  email: z.string().max(160).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  locality: z.string().max(120).nullable().optional(),
  pin_code: z.string().max(20).nullable().optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().trim().min(1).max(120),
  reason: z.string().max(400).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  consent_at: z.string().min(1).max(64),
  created_at: z.string().min(1).max(64),
});

export type RemoteInquiry = z.infer<typeof remoteInquirySchema>;

type RuntimeSync = {
  state: InquirySyncState;
  lastAttemptAt: string | null;
  lastError: string | null;
  inFlight: Promise<{ added: number; status: InquirySyncStatus }> | null;
};

const runtimeMap = new WeakMap<Ctx, RuntimeSync>();

function runtime(ctx: Ctx): RuntimeSync {
  let rt = runtimeMap.get(ctx);
  if (!rt) {
    rt = { state: "idle", lastAttemptAt: null, lastError: null, inFlight: null };
    runtimeMap.set(ctx, rt);
  }
  return rt;
}

export function validateWebsiteUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "Enter a valid website URL (for example, https://namma-physio-centre-psi.vercel.app)");
  }
  const isLoopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
    throw new HttpError(400, "Website URL must use HTTPS to protect patient information");
  }
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/+$/, "");
}

export function getWebsiteUrl(ctx: Ctx): string {
  const stored = getKV(ctx.db, KV_URL);
  if (stored) return stored;
  const envUrl = process.env.NPB_WEBSITE_URL?.trim();
  if (envUrl) {
    try {
      return validateWebsiteUrl(envUrl);
    } catch {
      return DEFAULT_WEBSITE_URL;
    }
  }
  return DEFAULT_WEBSITE_URL;
}

function getSyncToken(ctx: Ctx): string | null {
  const stored = getKV(ctx.db, KV_TOKEN);
  if (stored) {
    try {
      return ctx.secretStore.decrypt(stored);
    } catch {
      return null;
    }
  }
  const envToken = process.env.NPB_SYNC_TOKEN?.trim();
  return envToken && envToken.length >= 20 ? envToken : null;
}

function getCursor(db: DB): number {
  const v = Number(getKV(db, KV_CURSOR) ?? "0");
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function totalCount(db: DB): number {
  return (db.prepare("SELECT COUNT(*) c FROM appointment_inquiries").get() as { c: number }).c;
}

export function getInquirySyncStatus(ctx: Ctx): InquirySyncStatus {
  const rt = runtime(ctx);
  const configured = !!getSyncToken(ctx);
  const state: InquirySyncState = !configured ? "unconfigured" : rt.state === "unconfigured" ? "idle" : rt.state;
  return {
    configured,
    websiteUrl: getWebsiteUrl(ctx),
    state,
    lastSyncAt: getKV(ctx.db, KV_LAST_SYNC),
    lastAttemptAt: rt.lastAttemptAt,
    lastError: configured ? rt.lastError : null,
    totalInquiries: totalCount(ctx.db),
  };
}

type DbInquiryRow = {
  id: number;
  remote_id: number | null;
  reference: string;
  visit_type: "clinic" | "home";
  patient_name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  locality: string | null;
  pin_code: string | null;
  preferred_date: string;
  preferred_time: string;
  reason: string | null;
  notes: string | null;
  consent_at: string;
  submitted_at: string;
  synced_at: string;
};

export function listLocalInquiries(
  db: DB,
  opts: { q?: string; visitType?: string; limit?: number } = {},
): { items: AppointmentInquiry[]; total: number } {
  const q = (opts.q ?? "").trim();
  const visitType = opts.visitType === "clinic" || opts.visitType === "home" ? opts.visitType : "";
  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 200));

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (visitType) {
    clauses.push("visit_type = ?");
    params.push(visitType);
  }
  if (q) {
    const like = `%${q}%`;
    clauses.push(
      "(patient_name LIKE ? OR mobile LIKE ? OR reference LIKE ? OR IFNULL(locality, '') LIKE ? OR IFNULL(reason, '') LIKE ? OR IFNULL(email, '') LIKE ?)",
    );
    params.push(like, like, like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) c FROM appointment_inquiries ${where}`).get(...params) as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT * FROM appointment_inquiries ${where}
       ORDER BY submitted_at DESC, COALESCE(remote_id, 0) DESC, id DESC
       LIMIT ?`,
    )
    .all(...params, limit) as DbInquiryRow[];

  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      remoteId: r.remote_id,
      reference: r.reference,
      visitType: r.visit_type,
      patientName: r.patient_name,
      mobile: r.mobile,
      email: r.email,
      address: r.address,
      locality: r.locality,
      pinCode: r.pin_code,
      preferredDate: r.preferred_date,
      preferredTime: r.preferred_time,
      reason: r.reason,
      notes: r.notes,
      consentAt: r.consent_at,
      submittedAt: r.submitted_at,
      syncedAt: r.synced_at,
    })),
  };
}

/** Idempotently stores website inquiries without creating duplicates. Returns newly added count. */
export function upsertRemoteInquiries(db: DB, items: RemoteInquiry[]): number {
  if (items.length === 0) return 0;
  const existsStmt = db.prepare("SELECT 1 FROM appointment_inquiries WHERE reference = ?");
  const upsertStmt = db.prepare(`
    INSERT INTO appointment_inquiries
      (remote_id, reference, visit_type, patient_name, mobile, email,
       address, locality, pin_code, preferred_date, preferred_time,
       reason, notes, consent_at, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(reference) DO UPDATE SET
      remote_id = COALESCE(excluded.remote_id, appointment_inquiries.remote_id)
  `);

  let added = 0;
  db.transaction(() => {
    for (const r of items) {
      const seen = existsStmt.get(r.reference);
      upsertStmt.run(
        r.id || null,
        r.reference,
        r.visit_type,
        r.patient_name,
        r.mobile,
        r.email ?? null,
        r.address ?? null,
        r.locality ?? null,
        r.pin_code ?? null,
        r.preferred_date,
        r.preferred_time,
        r.reason ?? null,
        r.notes ?? null,
        r.consent_at,
        r.created_at,
      );
      if (!seen) added++;
    }
  })();
  return added;
}

const syncResponseSchema = z.object({
  inquiries: z.array(remoteInquirySchema),
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean().optional(),
});

export function syncInquiriesNow(ctx: Ctx): Promise<{ added: number; status: InquirySyncStatus }> {
  const rt = runtime(ctx);
  if (rt.inFlight) return rt.inFlight;

  const task = (async () => {
    const token = getSyncToken(ctx);
    if (!token) {
      rt.state = "unconfigured";
      rt.lastError = null;
      return { added: 0, status: getInquirySyncStatus(ctx) };
    }

    const websiteUrl = getWebsiteUrl(ctx);
    rt.state = "syncing";
    rt.lastAttemptAt = nowIso();

    let totalAdded = 0;
    let cursor = getCursor(ctx.db);

    try {
      for (let page = 0; page < 25; page++) {
        const res = await fetch(`${websiteUrl}/api/inquiries/sync?after_id=${cursor}&limit=200`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(12_000),
        });

        if (res.status === 401 || res.status === 403) {
          rt.state = "auth_error";
          rt.lastError = "Sync credentials were rejected by the website. Reconnect in Sync settings.";
          return { added: totalAdded, status: getInquirySyncStatus(ctx) };
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          rt.state = "error";
          rt.lastError = body?.error ?? `Website returned HTTP ${res.status}`;
          return { added: totalAdded, status: getInquirySyncStatus(ctx) };
        }

        const payload = syncResponseSchema.parse(await res.json());
        totalAdded += upsertRemoteInquiries(ctx.db, payload.inquiries);

        const prevCursor = cursor;
        const nextCursor = Math.max(cursor, payload.nextCursor);
        if (nextCursor > cursor) {
          cursor = nextCursor;
          setKV(ctx.db, KV_CURSOR, String(cursor));
        }

        if (!payload.hasMore || payload.inquiries.length === 0 || nextCursor <= prevCursor) {
          break;
        }
      }

      setKV(ctx.db, KV_LAST_SYNC, nowIso());
      rt.state = "idle";
      rt.lastError = null;
      return { added: totalAdded, status: getInquirySyncStatus(ctx) };
    } catch (e) {
      if (e instanceof z.ZodError) {
        rt.state = "error";
        rt.lastError = "Unexpected sync response format from website.";
      } else {
        rt.state = "offline";
        rt.lastError = "Offline — pending website inquiries will sync automatically when internet reconnects.";
      }
      return { added: totalAdded, status: getInquirySyncStatus(ctx) };
    }
  })();

  rt.inFlight = task.finally(() => {
    rt.inFlight = null;
  });
  return rt.inFlight;
}

export async function connectWebsiteSync(
  ctx: Ctx,
  input: { websiteUrl: string; password?: string; token?: string },
  actor: SessionUser,
): Promise<{ added: number; status: InquirySyncStatus }> {
  const websiteUrl = validateWebsiteUrl(input.websiteUrl);
  let syncToken = input.token?.trim() ?? "";

  if (syncToken) {
    if (syncToken.length < 20) throw new HttpError(400, "Sync token must be at least 20 characters");
    let checkRes: Response;
    try {
      checkRes = await fetch(`${websiteUrl}/api/inquiries/sync?after_id=0&limit=1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${syncToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new HttpError(502, "Could not reach the website. Check your internet connection and URL.");
    }
    if (checkRes.status === 401 || checkRes.status === 403) {
      throw new HttpError(401, "The website rejected this sync token.");
    }
    if (!checkRes.ok) {
      const errBody = (await checkRes.json().catch(() => null)) as { error?: string } | null;
      throw new HttpError(502, errBody?.error ?? `Website returned HTTP ${checkRes.status}`);
    }
  } else if (input.password?.trim()) {
    let pairRes: Response;
    try {
      pairRes = await fetch(`${websiteUrl}/api/inquiries/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          password: input.password,
          deviceLabel: getSettings(ctx.db).clinic.name,
        }),
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new HttpError(502, "Could not reach the website. Check your internet connection and URL.");
    }
    const body = (await pairRes.json().catch(() => null)) as { token?: string; error?: string } | null;
    if (!pairRes.ok || !body?.token) {
      throw new HttpError(pairRes.status === 401 ? 401 : 400, body?.error ?? "Could not pair with the website");
    }
    syncToken = body.token;
  } else {
    throw new HttpError(400, "Provide either the website admin password or a sync token");
  }

  setKV(ctx.db, KV_URL, websiteUrl);
  setKV(ctx.db, KV_TOKEN, ctx.secretStore.encrypt(syncToken));
  setKV(ctx.db, KV_CURSOR, "0");

  const rt = runtime(ctx);
  rt.state = "idle";
  rt.lastError = null;

  audit(ctx.db, actor, "inquiries.connect", "settings", KV_URL, { websiteUrl });
  return syncInquiriesNow(ctx);
}

export function disconnectWebsiteSync(ctx: Ctx, actor: SessionUser): InquirySyncStatus {
  setKV(ctx.db, KV_TOKEN, null);
  const rt = runtime(ctx);
  rt.state = "unconfigured";
  rt.lastError = null;
  audit(ctx.db, actor, "inquiries.disconnect", "settings", KV_URL);
  return getInquirySyncStatus(ctx);
}

function verifyBearerAgainstConfigured(ctx: Ctx, authHeader: string | undefined): boolean {
  const configured = getSyncToken(ctx);
  if (!configured || !authHeader) return false;
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
  if (!m) return false;
  const a = crypto.createHash("sha256").update(m[1], "utf8").digest();
  const b = crypto.createHash("sha256").update(configured, "utf8").digest();
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function receiveInquiryWebhook(ctx: Ctx, authHeader: string | undefined, body: unknown): { added: number } {
  if (!verifyBearerAgainstConfigured(ctx, authHeader)) {
    throw new HttpError(401, "Unauthorized webhook");
  }
  const parsed = z.object({ inquiry: remoteInquirySchema }).parse(body);
  const added = upsertRemoteInquiries(ctx.db, [parsed.inquiry]);
  setKV(ctx.db, KV_LAST_SYNC, nowIso());
  const rt = runtime(ctx);
  rt.state = "idle";
  rt.lastError = null;
  return { added };
}

export function startInquirySync(
  ctx: Ctx,
  opts: { intervalMs?: number; log?: (msg: string) => void } = {},
) {
  const intervalMs = opts.intervalMs ?? 15_000;
  const tick = () => {
    if (!getSyncToken(ctx)) return;
    void syncInquiriesNow(ctx).then((r) => {
      if (r.added > 0 && opts.log) opts.log(`[inquiries] synchronized ${r.added} new website inquiry(s)`);
    });
  };
  const initial = setTimeout(tick, 600);
  initial.unref?.();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => {
    clearTimeout(initial);
    clearInterval(timer);
  };
}
