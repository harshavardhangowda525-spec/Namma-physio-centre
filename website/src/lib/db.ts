import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Review } from "@/content/reviews";
import { generateOpaqueToken, sha256Hex } from "./crypto";

export type VisitType = "clinic" | "home";

export type RequestStatus =
  | "requested"
  | "pending_approval"
  | "confirmed"
  | "reschedule_proposed"
  | "rescheduled"
  | "declined"
  | "rejected"
  | "cancelled"
  | "completed";

export function statusLabel(status: RequestStatus): string {
  switch (status) {
    case "requested":
    case "pending_approval":
      return "Pending Doctor Approval";
    case "confirmed":
      return "Confirmed";
    case "reschedule_proposed":
    case "rescheduled":
      return "Reschedule Proposed";
    case "declined":
    case "rejected":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
  }
}

export function canonicalStatusGroup(
  status: RequestStatus,
): "pending_approval" | "confirmed" | "reschedule_proposed" | "declined" | "cancelled" | "completed" {
  if (status === "requested" || status === "pending_approval") return "pending_approval";
  if (status === "rescheduled" || status === "reschedule_proposed") return "reschedule_proposed";
  if (status === "rejected" || status === "declined") return "declined";
  return status;
}

export type AppointmentRequest = {
  id: number;
  reference: string;
  visit_type: VisitType;
  status: RequestStatus;
  patient_name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  locality: string | null;
  pin_code: string | null;
  preferred_date: string;
  preferred_time: string;
  requested_service: string | null;
  reason: string | null;
  notes: string | null;
  consent_at: string;
  confirmed_date: string | null;
  confirmed_time: string | null;
  proposed_date: string | null;
  proposed_time: string | null;
  decline_reason: string | null;
  duration_minutes: number;
  approved_at: string | null;
  approved_by: string | null;
  clinic_message: string | null;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NewRequest = {
  reference: string;
  visit_type: VisitType;
  patient_name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  locality: string | null;
  pin_code: string | null;
  preferred_date: string;
  preferred_time: string;
  requested_service?: string | null;
  reason: string | null;
  notes: string | null;
  consent_at: string;
};

export type TokenPurpose = "doctor_manage" | "patient_reschedule";

export type ActionTokenRecord = {
  token_hash: string;
  appointment_id: number;
  purpose: TokenPurpose;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type AppointmentAuditEntry = {
  id: number;
  appointment_id: number;
  reference: string;
  actor: string;
  action: string;
  previous_status: string | null;
  new_status: string;
  details: string | null;
  created_at: string;
};

export type EmailDeliveryStatus = "pending" | "submitted_to_gmail" | "sent_fallback" | "failed" | "skipped";

export type EmailDeliveryLog = {
  id: number;
  dedupe_key: string;
  appointment_id: number | null;
  reference: string | null;
  template: string;
  recipient_masked: string;
  provider: string;
  status: EmailDeliveryStatus;
  gmail_message_id: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewsSyncMeta = {
  provider: string;
  location_name: string | null;
  rating: number | null;
  total_reviews: number | null;
  synced_reviews: number;
  last_synced_at: string | null;
  last_attempt_at: string | null;
  last_status: string;
  last_error: string | null;
};

export class StorageUnavailableError extends Error {}

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

type Mem = {
  requests: AppointmentRequest[];
  tokens: Map<string, string>;
  actionTokens: Map<string, ActionTokenRecord>;
  audits: AppointmentAuditEntry[];
  emails: Map<string, EmailDeliveryLog>;
  importedReviews: Review[];
  reviewsMeta: ReviewsSyncMeta | null;
  seq: number;
  auditSeq: number;
  emailSeq: number;
};

const g = globalThis as unknown as { __npcMem?: Mem; __npcSchemaReady?: Promise<void> };

function mem(): Mem {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "1") {
    throw new StorageUnavailableError("DATABASE_URL is not configured");
  }
  g.__npcMem ??= {
    requests: [],
    tokens: new Map(),
    actionTokens: new Map(),
    audits: [],
    emails: new Map(),
    importedReviews: [],
    reviewsMeta: null,
    seq: 0,
    auditSeq: 0,
    emailSeq: 0,
  };
  return g.__npcMem;
}

export const storageMode = sql ? "neon" : "memory";

/**
 * Ensures additive v2 columns and tables exist in Neon even if an admin hasn't
 * re-run `npm run db:migrate` yet. Completely non-destructive and idempotent.
 */
async function ensureSchema(): Promise<void> {
  if (!sql) return;
  if (!g.__npcSchemaReady) {
    g.__npcSchemaReady = (async () => {
      try {
        await sql`ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS requested_service TEXT`;
        await sql`ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS proposed_date DATE`;
        await sql`ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS proposed_time TEXT`;
        await sql`ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS decline_reason TEXT`;
        await sql`ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 45`;
        await sql`ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
        await sql`ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS approved_by TEXT`;
        await sql`ALTER TABLE appointment_requests DROP CONSTRAINT IF EXISTS appointment_requests_status_check`;
        await sql`ALTER TABLE appointment_requests ADD CONSTRAINT appointment_requests_status_check CHECK (status IN ('requested', 'pending_approval', 'confirmed', 'reschedule_proposed', 'rescheduled', 'declined', 'rejected', 'cancelled', 'completed'))`;

        await sql`CREATE TABLE IF NOT EXISTS appointment_action_tokens (
          token_hash     TEXT PRIMARY KEY,
          appointment_id BIGINT NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
          purpose        TEXT NOT NULL CHECK (purpose IN ('doctor_manage', 'patient_reschedule')),
          expires_at     TIMESTAMPTZ NOT NULL,
          used_at        TIMESTAMPTZ,
          revoked_at     TIMESTAMPTZ,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
        await sql`CREATE TABLE IF NOT EXISTS appointment_audit_log (
          id              BIGSERIAL PRIMARY KEY,
          appointment_id  BIGINT NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
          reference       TEXT NOT NULL,
          actor           TEXT NOT NULL,
          action          TEXT NOT NULL,
          previous_status TEXT,
          new_status      TEXT NOT NULL,
          details         TEXT,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
        await sql`CREATE TABLE IF NOT EXISTS email_delivery_logs (
          id                BIGSERIAL PRIMARY KEY,
          dedupe_key        TEXT NOT NULL UNIQUE,
          appointment_id    BIGINT REFERENCES appointment_requests(id) ON DELETE SET NULL,
          reference         TEXT,
          template          TEXT NOT NULL,
          recipient_masked  TEXT NOT NULL,
          provider          TEXT NOT NULL,
          status            TEXT NOT NULL CHECK (status IN ('pending', 'submitted_to_gmail', 'sent_fallback', 'failed', 'skipped')),
          gmail_message_id  TEXT,
          attempts          INTEGER NOT NULL DEFAULT 0,
          last_error        TEXT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
        await sql`ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS author_photo TEXT`;
        await sql`ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS author_url TEXT`;
        await sql`ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS sync_source TEXT NOT NULL DEFAULT 'authorised-import'`;
        await sql`ALTER TABLE imported_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
        await sql`CREATE TABLE IF NOT EXISTS google_reviews_sync_meta (
          id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          provider        TEXT NOT NULL DEFAULT 'none',
          location_name   TEXT,
          rating          NUMERIC(3,2),
          total_reviews   INTEGER,
          synced_reviews  INTEGER NOT NULL DEFAULT 0,
          last_synced_at  TIMESTAMPTZ,
          last_attempt_at TIMESTAMPTZ,
          last_status     TEXT NOT NULL DEFAULT 'never',
          last_error      TEXT
        )`;
      } catch (e) {
        console.warn("[db] schema ensure note:", (e as Error).message);
      }
    })();
  }
  await g.__npcSchemaReady;
}

const DEFAULT_DURATION = Number(process.env.DEFAULT_APPOINTMENT_MINUTES || 45) || 45;

export async function insertRequest(r: NewRequest): Promise<AppointmentRequest> {
  const reqService = r.requested_service ?? null;
  if (sql) {
    await ensureSchema();
    const rows = await sql`
      INSERT INTO appointment_requests
        (reference, visit_type, status, patient_name, mobile, email, address, locality, pin_code,
         preferred_date, preferred_time, requested_service, reason, notes, consent_at, duration_minutes)
      VALUES (${r.reference}, ${r.visit_type}, 'pending_approval', ${r.patient_name}, ${r.mobile}, ${r.email}, ${r.address},
              ${r.locality}, ${r.pin_code}, ${r.preferred_date}, ${r.preferred_time}, ${reqService}, ${r.reason}, ${r.notes}, ${r.consent_at}, ${DEFAULT_DURATION})
      RETURNING *`;
    return normalise(rows[0]);
  }
  const m = mem();
  const now = new Date().toISOString();
  const row: AppointmentRequest = {
    ...r,
    requested_service: reqService,
    id: ++m.seq,
    status: "pending_approval",
    confirmed_date: null,
    confirmed_time: null,
    proposed_date: null,
    proposed_time: null,
    decline_reason: null,
    duration_minutes: DEFAULT_DURATION,
    approved_at: null,
    approved_by: null,
    clinic_message: null,
    calendar_event_id: null,
    created_at: now,
    updated_at: now,
  };
  m.requests.unshift(row);
  return row;
}

function statusMatchesFilter(rowStatus: RequestStatus, filter?: RequestStatus | "all"): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "pending_approval" || filter === "requested") {
    return rowStatus === "pending_approval" || rowStatus === "requested";
  }
  if (filter === "reschedule_proposed" || filter === "rescheduled") {
    return rowStatus === "reschedule_proposed" || rowStatus === "rescheduled";
  }
  if (filter === "declined" || filter === "rejected") {
    return rowStatus === "declined" || rowStatus === "rejected";
  }
  return rowStatus === filter;
}

export async function listRequests(status?: RequestStatus | "all"): Promise<AppointmentRequest[]> {
  if (sql) {
    await ensureSchema();
    let rows: Record<string, unknown>[];
    if (!status || status === "all") {
      rows = await sql`SELECT * FROM appointment_requests ORDER BY created_at DESC LIMIT 500`;
    } else if (status === "pending_approval" || status === "requested") {
      rows = await sql`SELECT * FROM appointment_requests WHERE status IN ('pending_approval', 'requested') ORDER BY created_at DESC LIMIT 500`;
    } else if (status === "reschedule_proposed" || status === "rescheduled") {
      rows = await sql`SELECT * FROM appointment_requests WHERE status IN ('reschedule_proposed', 'rescheduled') ORDER BY created_at DESC LIMIT 500`;
    } else if (status === "declined" || status === "rejected") {
      rows = await sql`SELECT * FROM appointment_requests WHERE status IN ('declined', 'rejected') ORDER BY created_at DESC LIMIT 500`;
    } else {
      rows = await sql`SELECT * FROM appointment_requests WHERE status = ${status} ORDER BY created_at DESC LIMIT 500`;
    }
    return rows.map(normalise);
  }
  const all = mem().requests;
  return all.filter((r) => statusMatchesFilter(r.status, status));
}

export async function getRequest(id: number): Promise<AppointmentRequest | null> {
  if (sql) {
    await ensureSchema();
    const rows = await sql`SELECT * FROM appointment_requests WHERE id = ${id}`;
    return rows[0] ? normalise(rows[0]) : null;
  }
  return mem().requests.find((r) => r.id === id) ?? null;
}

export type RequestPatch = Partial<
  Pick<
    AppointmentRequest,
    | "status"
    | "confirmed_date"
    | "confirmed_time"
    | "proposed_date"
    | "proposed_time"
    | "decline_reason"
    | "duration_minutes"
    | "approved_at"
    | "approved_by"
    | "clinic_message"
    | "calendar_event_id"
  >
>;

export async function updateRequest(id: number, patch: RequestPatch): Promise<AppointmentRequest | null> {
  const cur = await getRequest(id);
  if (!cur) return null;
  const next: AppointmentRequest = { ...cur, ...patch };
  if (sql) {
    await ensureSchema();
    const rows = await sql`
      UPDATE appointment_requests SET
        status = ${next.status},
        confirmed_date = ${next.confirmed_date},
        confirmed_time = ${next.confirmed_time},
        proposed_date = ${next.proposed_date},
        proposed_time = ${next.proposed_time},
        decline_reason = ${next.decline_reason},
        duration_minutes = ${next.duration_minutes},
        approved_at = ${next.approved_at},
        approved_by = ${next.approved_by},
        clinic_message = ${next.clinic_message},
        calendar_event_id = ${next.calendar_event_id},
        updated_at = now()
      WHERE id = ${id} RETURNING *`;
    return normalise(rows[0]);
  }
  Object.assign(cur, patch, { updated_at: new Date().toISOString() });
  return cur;
}

/** Confirmed appointments on a date (used for scheduling overlap checks). */
export async function confirmedOn(date: string): Promise<AppointmentRequest[]> {
  if (sql) {
    await ensureSchema();
    const rows = await sql`
      SELECT * FROM appointment_requests
      WHERE (
        (status = 'confirmed' AND confirmed_date = ${date})
        OR (status IN ('rescheduled', 'reschedule_proposed') AND COALESCE(proposed_date, confirmed_date) = ${date})
      )`;
    return rows.map(normalise);
  }
  return mem().requests.filter(
    (r) =>
      (r.status === "confirmed" && r.confirmed_date === date) ||
      ((r.status === "rescheduled" || r.status === "reschedule_proposed") &&
        (r.proposed_date ?? r.confirmed_date) === date),
  );
}

/* ---------------- ACTION TOKENS (Approval & Reschedule Links) ---------------- */

export async function issueActionToken(
  appointmentId: number,
  purpose: TokenPurpose,
  ttlHours = 168, // 7 days default
): Promise<string> {
  const raw = generateOpaqueToken(purpose === "doctor_manage" ? "npc_doc" : "npc_pat");
  const tokenHash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();

  if (sql) {
    await ensureSchema();
    if (purpose === "patient_reschedule") {
      await sql`
        UPDATE appointment_action_tokens
        SET revoked_at = now()
        WHERE appointment_id = ${appointmentId} AND purpose = ${purpose} AND revoked_at IS NULL AND used_at IS NULL`;
    }
    await sql`
      INSERT INTO appointment_action_tokens (token_hash, appointment_id, purpose, expires_at)
      VALUES (${tokenHash}, ${appointmentId}, ${purpose}, ${expiresAt})`;
    return raw;
  }

  const m = mem();
  if (purpose === "patient_reschedule") {
    for (const rec of m.actionTokens.values()) {
      if (rec.appointment_id === appointmentId && rec.purpose === purpose && !rec.revoked_at && !rec.used_at) {
        rec.revoked_at = new Date().toISOString();
      }
    }
  }
  m.actionTokens.set(tokenHash, {
    token_hash: tokenHash,
    appointment_id: appointmentId,
    purpose,
    expires_at: expiresAt,
    used_at: null,
    revoked_at: null,
    created_at: new Date().toISOString(),
  });
  return raw;
}

export async function verifyActionToken(
  rawToken: string,
  purpose: TokenPurpose,
): Promise<
  | { valid: true; appointment: AppointmentRequest; tokenHash: string; usedAt: string | null; expiresAt: string }
  | { valid: false; reason: "invalid" | "expired" | "revoked" }
> {
  if (!rawToken || rawToken.length < 20) return { valid: false, reason: "invalid" };
  const tokenHash = sha256Hex(rawToken);

  if (sql) {
    await ensureSchema();
    const rows = await sql`
      SELECT * FROM appointment_action_tokens
      WHERE token_hash = ${tokenHash} AND purpose = ${purpose}
      LIMIT 1`;
    const rec = rows[0];
    if (!rec) return { valid: false, reason: "invalid" };
    if (rec.revoked_at) return { valid: false, reason: "revoked" };
    const exp = new Date(rec.expires_at as string).toISOString();
    if (new Date(exp).getTime() <= Date.now()) return { valid: false, reason: "expired" };
    const appt = await getRequest(Number(rec.appointment_id));
    if (!appt) return { valid: false, reason: "invalid" };
    return {
      valid: true,
      appointment: appt,
      tokenHash,
      usedAt: rec.used_at ? new Date(rec.used_at as string).toISOString() : null,
      expiresAt: exp,
    };
  }

  const rec = mem().actionTokens.get(tokenHash);
  if (!rec || rec.purpose !== purpose) return { valid: false, reason: "invalid" };
  if (rec.revoked_at) return { valid: false, reason: "revoked" };
  if (new Date(rec.expires_at).getTime() <= Date.now()) return { valid: false, reason: "expired" };
  const appt = await getRequest(rec.appointment_id);
  if (!appt) return { valid: false, reason: "invalid" };
  return { valid: true, appointment: appt, tokenHash, usedAt: rec.used_at, expiresAt: rec.expires_at };
}

export async function markActionTokenUsed(tokenHash: string): Promise<void> {
  if (sql) {
    await ensureSchema();
    await sql`UPDATE appointment_action_tokens SET used_at = COALESCE(used_at, now()) WHERE token_hash = ${tokenHash}`;
    return;
  }
  const rec = mem().actionTokens.get(tokenHash);
  if (rec && !rec.used_at) rec.used_at = new Date().toISOString();
}

/* ---------------- APPOINTMENT AUDIT HISTORY ---------------- */

export async function recordAppointmentAudit(entry: {
  appointmentId: number;
  reference: string;
  actor: string;
  action: string;
  previousStatus: string | null;
  newStatus: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const detailsJson = entry.details ? JSON.stringify(entry.details) : null;
  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO appointment_audit_log (appointment_id, reference, actor, action, previous_status, new_status, details)
      VALUES (${entry.appointmentId}, ${entry.reference}, ${entry.actor}, ${entry.action}, ${entry.previousStatus}, ${entry.newStatus}, ${detailsJson})`;
    return;
  }
  const m = mem();
  m.audits.unshift({
    id: ++m.auditSeq,
    appointment_id: entry.appointmentId,
    reference: entry.reference,
    actor: entry.actor,
    action: entry.action,
    previous_status: entry.previousStatus,
    new_status: entry.newStatus,
    details: detailsJson,
    created_at: new Date().toISOString(),
  });
}

export async function listAppointmentAudits(appointmentId?: number, limit = 50): Promise<AppointmentAuditEntry[]> {
  if (sql) {
    await ensureSchema();
    const rows = appointmentId
      ? await sql`SELECT * FROM appointment_audit_log WHERE appointment_id = ${appointmentId} ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM appointment_audit_log ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map((r) => ({
      id: Number(r.id),
      appointment_id: Number(r.appointment_id),
      reference: String(r.reference),
      actor: String(r.actor),
      action: String(r.action),
      previous_status: r.previous_status ? String(r.previous_status) : null,
      new_status: String(r.new_status),
      details: r.details ? String(r.details) : null,
      created_at: new Date(r.created_at as string).toISOString(),
    }));
  }
  const all = mem().audits;
  return (appointmentId ? all.filter((a) => a.appointment_id === appointmentId) : all).slice(0, limit);
}

/* ---------------- EMAIL DELIVERY LOGS & DEDUPLICATION ---------------- */

export async function findEmailDelivery(dedupeKey: string): Promise<EmailDeliveryLog | null> {
  if (sql) {
    await ensureSchema();
    const rows = await sql`SELECT * FROM email_delivery_logs WHERE dedupe_key = ${dedupeKey} LIMIT 1`;
    if (!rows[0]) return null;
    return normaliseEmailLog(rows[0]);
  }
  return mem().emails.get(dedupeKey) ?? null;
}

export async function recordEmailDelivery(entry: {
  dedupeKey: string;
  appointmentId?: number | null;
  reference?: string | null;
  template: string;
  recipientMasked: string;
  provider: string;
  status: EmailDeliveryStatus;
  gmailMessageId?: string | null;
  attempts: number;
  lastError?: string | null;
}): Promise<void> {
  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO email_delivery_logs
        (dedupe_key, appointment_id, reference, template, recipient_masked, provider, status, gmail_message_id, attempts, last_error)
      VALUES
        (${entry.dedupeKey}, ${entry.appointmentId ?? null}, ${entry.reference ?? null}, ${entry.template}, ${entry.recipientMasked},
         ${entry.provider}, ${entry.status}, ${entry.gmailMessageId ?? null}, ${entry.attempts}, ${entry.lastError ?? null})
      ON CONFLICT (dedupe_key) DO UPDATE SET
        provider = EXCLUDED.provider,
        status = EXCLUDED.status,
        gmail_message_id = COALESCE(EXCLUDED.gmail_message_id, email_delivery_logs.gmail_message_id),
        attempts = EXCLUDED.attempts,
        last_error = EXCLUDED.last_error,
        updated_at = now()`;
    return;
  }
  const m = mem();
  const existing = m.emails.get(entry.dedupeKey);
  const now = new Date().toISOString();
  m.emails.set(entry.dedupeKey, {
    id: existing?.id ?? ++m.emailSeq,
    dedupe_key: entry.dedupeKey,
    appointment_id: entry.appointmentId ?? null,
    reference: entry.reference ?? null,
    template: entry.template,
    recipient_masked: entry.recipientMasked,
    provider: entry.provider,
    status: entry.status,
    gmail_message_id: entry.gmailMessageId ?? existing?.gmail_message_id ?? null,
    attempts: entry.attempts,
    last_error: entry.lastError ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });
}

export async function listEmailDeliveries(limit = 30): Promise<EmailDeliveryLog[]> {
  if (sql) {
    await ensureSchema();
    const rows = await sql`SELECT * FROM email_delivery_logs ORDER BY updated_at DESC LIMIT ${limit}`;
    return rows.map(normaliseEmailLog);
  }
  return Array.from(mem().emails.values())
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit);
}

function normaliseEmailLog(r: Record<string, unknown>): EmailDeliveryLog {
  return {
    id: Number(r.id),
    dedupe_key: String(r.dedupe_key),
    appointment_id: r.appointment_id != null ? Number(r.appointment_id) : null,
    reference: r.reference ? String(r.reference) : null,
    template: String(r.template),
    recipient_masked: String(r.recipient_masked),
    provider: String(r.provider),
    status: r.status as EmailDeliveryStatus,
    gmail_message_id: r.gmail_message_id ? String(r.gmail_message_id) : null,
    attempts: Number(r.attempts ?? 0),
    last_error: r.last_error ? String(r.last_error) : null,
    created_at: new Date(r.created_at as string).toISOString(),
    updated_at: new Date(r.updated_at as string).toISOString(),
  };
}

/* ---------------- GOOGLE REVIEWS STORAGE & SYNC METADATA ---------------- */

export async function listImportedReviews(): Promise<Review[]> {
  if (!sql) {
    return g.__npcMem?.importedReviews ?? [];
  }
  try {
    await ensureSchema();
    const rows = await sql`SELECT * FROM imported_reviews ORDER BY review_date DESC NULLS LAST, updated_at DESC`;
    return rows.map((r) => ({
      id: String(r.id),
      author: String(r.author),
      authorPhoto: r.author_photo ? String(r.author_photo) : null,
      authorUrl: r.author_url ? String(r.author_url) : null,
      rating: Number(r.rating),
      date: r.review_date ? toDateString(r.review_date) : null,
      text: String(r.text),
      source: r.sync_source === "google-gbp" ? ("google-places" as const) : ("authorised-import" as const),
    }));
  } catch {
    return [];
  }
}

export type SyncedReviewInput = {
  id: string;
  author: string;
  authorPhoto?: string | null;
  authorUrl?: string | null;
  rating: number;
  date: string | null;
  text: string;
  syncSource: "google-gbp" | "google-places";
};

export async function getReviewsSyncMeta(): Promise<ReviewsSyncMeta | null> {
  if (!sql) return g.__npcMem?.reviewsMeta ?? null;
  try {
    await ensureSchema();
    const rows = await sql`SELECT * FROM google_reviews_sync_meta WHERE id = 1 LIMIT 1`;
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      provider: String(r.provider),
      location_name: r.location_name ? String(r.location_name) : null,
      rating: r.rating != null ? Number(r.rating) : null,
      total_reviews: r.total_reviews != null ? Number(r.total_reviews) : null,
      synced_reviews: Number(r.synced_reviews ?? 0),
      last_synced_at: r.last_synced_at ? new Date(r.last_synced_at as string).toISOString() : null,
      last_attempt_at: r.last_attempt_at ? new Date(r.last_attempt_at as string).toISOString() : null,
      last_status: String(r.last_status),
      last_error: r.last_error ? String(r.last_error) : null,
    };
  } catch {
    return null;
  }
}

export async function saveSyncedGoogleReviews(opts: {
  provider: "google-gbp" | "google-places";
  locationName?: string | null;
  rating: number;
  totalReviews: number;
  reviews: SyncedReviewInput[];
  replaceAllFromSource?: boolean;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!sql) {
    const m = mem();
    if (opts.replaceAllFromSource && opts.provider === "google-gbp") {
      const incomingIds = new Set(opts.reviews.map((r) => r.id));
      m.importedReviews = m.importedReviews.filter((r) => incomingIds.has(r.id));
    }
    const byId = new Map(m.importedReviews.map((r) => [r.id, r]));
    for (const r of opts.reviews) {
      byId.set(r.id, {
        id: r.id,
        author: r.author,
        authorPhoto: r.authorPhoto ?? null,
        authorUrl: r.authorUrl ?? null,
        rating: r.rating,
        date: r.date,
        text: r.text,
        source: "google-places",
      });
    }
    m.importedReviews = Array.from(byId.values());
    m.reviewsMeta = {
      provider: opts.provider,
      location_name: opts.locationName ?? null,
      rating: opts.rating,
      total_reviews: opts.totalReviews,
      synced_reviews: opts.reviews.length,
      last_synced_at: nowIso,
      last_attempt_at: nowIso,
      last_status: "ok",
      last_error: null,
    };
    return;
  }

  await ensureSchema();
  if (opts.provider === "google-gbp") {
    // Upsert all current GBP reviews and prune reviews deleted on Google Business Profile
    for (const r of opts.reviews) {
      await sql`
        INSERT INTO imported_reviews (id, author, author_photo, author_url, rating, review_date, text, source_note, sync_source, updated_at)
        VALUES (${r.id}, ${r.author}, ${r.authorPhoto ?? null}, ${r.authorUrl ?? null}, ${r.rating}, ${r.date}, ${r.text}, 'Google Business Profile API sync', 'google-gbp', now())
        ON CONFLICT (id) DO UPDATE SET
          author = EXCLUDED.author,
          author_photo = EXCLUDED.author_photo,
          author_url = EXCLUDED.author_url,
          rating = EXCLUDED.rating,
          review_date = EXCLUDED.review_date,
          text = EXCLUDED.text,
          updated_at = now()`;
    }
    if (opts.replaceAllFromSource) {
      const keepIds = opts.reviews.map((r) => r.id);
      if (keepIds.length > 0) {
        await sql`DELETE FROM imported_reviews WHERE sync_source = 'google-gbp' AND NOT (id = ANY(${keepIds}))`;
      } else {
        await sql`DELETE FROM imported_reviews WHERE sync_source = 'google-gbp'`;
      }
    }
  }

  await sql`
    INSERT INTO google_reviews_sync_meta
      (id, provider, location_name, rating, total_reviews, synced_reviews, last_synced_at, last_attempt_at, last_status, last_error)
    VALUES
      (1, ${opts.provider}, ${opts.locationName ?? null}, ${opts.rating}, ${opts.totalReviews}, ${opts.reviews.length}, now(), now(), 'ok', NULL)
    ON CONFLICT (id) DO UPDATE SET
      provider = EXCLUDED.provider,
      location_name = COALESCE(EXCLUDED.location_name, google_reviews_sync_meta.location_name),
      rating = EXCLUDED.rating,
      total_reviews = EXCLUDED.total_reviews,
      synced_reviews = EXCLUDED.synced_reviews,
      last_synced_at = now(),
      last_attempt_at = now(),
      last_status = 'ok',
      last_error = NULL`;
}

export async function recordReviewsSyncFailure(provider: string, errorMessage: string): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!sql) {
    const m = mem();
    m.reviewsMeta = {
      provider,
      location_name: m.reviewsMeta?.location_name ?? null,
      rating: m.reviewsMeta?.rating ?? null,
      total_reviews: m.reviewsMeta?.total_reviews ?? null,
      synced_reviews: m.reviewsMeta?.synced_reviews ?? 0,
      last_synced_at: m.reviewsMeta?.last_synced_at ?? null,
      last_attempt_at: nowIso,
      last_status: "error",
      last_error: errorMessage.slice(0, 300),
    };
    return;
  }
  await ensureSchema();
  await sql`
    INSERT INTO google_reviews_sync_meta (id, provider, synced_reviews, last_attempt_at, last_status, last_error)
    VALUES (1, ${provider}, 0, now(), 'error', ${errorMessage.slice(0, 300)})
    ON CONFLICT (id) DO UPDATE SET
      provider = EXCLUDED.provider,
      last_attempt_at = now(),
      last_status = 'error',
      last_error = EXCLUDED.last_error`;
}

/* ---------------- INTEGRATION TOKENS & BILLING INQUIRY SYNC ---------------- */

export async function getToken(provider: string): Promise<string | null> {
  if (sql) {
    const rows = await sql`SELECT ciphertext FROM integration_tokens WHERE provider = ${provider}`;
    return rows[0]?.ciphertext ?? null;
  }
  return mem().tokens.get(provider) ?? null;
}

export async function setToken(provider: string, ciphertext: string | null) {
  if (sql) {
    if (ciphertext === null) await sql`DELETE FROM integration_tokens WHERE provider = ${provider}`;
    else
      await sql`INSERT INTO integration_tokens (provider, ciphertext) VALUES (${provider}, ${ciphertext})
        ON CONFLICT (provider) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = now()`;
    return;
  }
  if (ciphertext === null) mem().tokens.delete(provider);
  else mem().tokens.set(provider, ciphertext);
}

export type SyncedInquiry = Pick<
  AppointmentRequest,
  | "id"
  | "reference"
  | "visit_type"
  | "patient_name"
  | "mobile"
  | "email"
  | "address"
  | "locality"
  | "pin_code"
  | "preferred_date"
  | "preferred_time"
  | "reason"
  | "notes"
  | "consent_at"
  | "created_at"
>;

export function toSyncedInquiry(r: AppointmentRequest): SyncedInquiry {
  return {
    id: r.id,
    reference: r.reference,
    visit_type: r.visit_type,
    patient_name: r.patient_name,
    mobile: r.mobile,
    email: r.email,
    address: r.address,
    locality: r.locality,
    pin_code: r.pin_code,
    preferred_date: r.preferred_date,
    preferred_time: r.preferred_time,
    reason: r.reason ?? r.requested_service ?? null,
    notes: r.notes,
    consent_at: r.consent_at,
    created_at: r.created_at,
  };
}

/** Prevents duplicate entries if a patient double-submits the identical inquiry within 5 minutes. */
export async function findRecentDuplicateRequest(r: NewRequest): Promise<AppointmentRequest | null> {
  if (sql) {
    await ensureSchema();
    const rows = await sql`
      SELECT * FROM appointment_requests
      WHERE mobile = ${r.mobile}
        AND visit_type = ${r.visit_type}
        AND preferred_date = ${r.preferred_date}
        AND preferred_time = ${r.preferred_time}
        AND LOWER(patient_name) = LOWER(${r.patient_name})
        AND created_at >= now() - interval '5 minutes'
      ORDER BY id DESC
      LIMIT 1`;
    return rows[0] ? normalise(rows[0]) : null;
  }
  const cutoff = Date.now() - 5 * 60_000;
  return (
    mem().requests.find(
      (x) =>
        x.mobile === r.mobile &&
        x.visit_type === r.visit_type &&
        x.preferred_date === r.preferred_date &&
        x.preferred_time === r.preferred_time &&
        x.patient_name.toLowerCase() === r.patient_name.toLowerCase() &&
        new Date(x.created_at).getTime() >= cutoff,
    ) ?? null
  );
}

/** Returns inquiries in ascending ID order for cursor-based synchronization with the local billing app. */
export async function listInquiriesForSync(afterId = 0, limit = 200): Promise<SyncedInquiry[]> {
  const safeAfter = Math.max(0, Math.floor(afterId));
  const safeLimit = Math.min(500, Math.max(1, Math.floor(limit)));
  if (sql) {
    await ensureSchema();
    const rows =
      safeAfter === 0
        ? await sql`SELECT * FROM appointment_requests ORDER BY id ASC LIMIT ${safeLimit}`
        : await sql`
            SELECT * FROM appointment_requests
            WHERE id > ${safeAfter}
               OR (id > ${Math.max(0, safeAfter - 50)} AND created_at >= now() - interval '2 minutes')
            ORDER BY id ASC
            LIMIT ${safeLimit}`;
    return rows.map((r) => toSyncedInquiry(normalise(r)));
  }
  const cutoff = Date.now() - 2 * 60_000;
  return mem()
    .requests.filter(
      (r) =>
        r.id > safeAfter ||
        (safeAfter > 0 && r.id > Math.max(0, safeAfter - 50) && new Date(r.created_at).getTime() >= cutoff),
    )
    .sort((a, b) => a.id - b.id)
    .slice(0, safeLimit)
    .map(toSyncedInquiry);
}

function toDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function normalise(row: Record<string, unknown>): AppointmentRequest {
  const r = row as unknown as AppointmentRequest;
  return {
    ...r,
    id: Number(r.id),
    requested_service: r.requested_service ?? null,
    preferred_date: toDateString(r.preferred_date),
    confirmed_date: r.confirmed_date ? toDateString(r.confirmed_date) : null,
    proposed_date: r.proposed_date ? toDateString(r.proposed_date) : null,
    proposed_time: r.proposed_time ?? null,
    decline_reason: r.decline_reason ?? null,
    duration_minutes: Number(r.duration_minutes ?? DEFAULT_DURATION),
    approved_at: r.approved_at ? new Date(r.approved_at as unknown as string).toISOString() : null,
    approved_by: r.approved_by ?? null,
    consent_at: new Date(r.consent_at as unknown as string).toISOString(),
    created_at: new Date(r.created_at as unknown as string).toISOString(),
    updated_at: new Date(r.updated_at as unknown as string).toISOString(),
  };
}
