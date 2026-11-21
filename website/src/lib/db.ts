import "server-only";
import { neon } from "@neondatabase/serverless";
import type { Review } from "@/content/reviews";

export type VisitType = "clinic" | "home";
export type RequestStatus = "requested" | "confirmed" | "rescheduled" | "rejected" | "cancelled";

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
  reason: string | null;
  notes: string | null;
  consent_at: string;
  confirmed_date: string | null;
  confirmed_time: string | null;
  clinic_message: string | null;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NewRequest = Omit<
  AppointmentRequest,
  "id" | "status" | "confirmed_date" | "confirmed_time" | "clinic_message" | "calendar_event_id" | "created_at" | "updated_at"
>;

export class StorageUnavailableError extends Error {}

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

/**
 * Development-only in-memory store, so the site can be run locally without a
 * database. It is never used in production: a missing DATABASE_URL there
 * makes booking endpoints return 503 instead of silently losing requests.
 */
type Mem = { requests: AppointmentRequest[]; tokens: Map<string, string>; seq: number };
const g = globalThis as unknown as { __npcMem?: Mem };
function mem(): Mem {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "1") throw new StorageUnavailableError("DATABASE_URL is not configured");
  g.__npcMem ??= { requests: [], tokens: new Map(), seq: 0 };
  return g.__npcMem;
}

export const storageMode = sql ? "neon" : "memory";

export async function insertRequest(r: NewRequest): Promise<AppointmentRequest> {
  if (sql) {
    const rows = await sql`
      INSERT INTO appointment_requests
        (reference, visit_type, patient_name, mobile, email, address, locality, pin_code,
         preferred_date, preferred_time, reason, notes, consent_at)
      VALUES (${r.reference}, ${r.visit_type}, ${r.patient_name}, ${r.mobile}, ${r.email}, ${r.address},
              ${r.locality}, ${r.pin_code}, ${r.preferred_date}, ${r.preferred_time}, ${r.reason}, ${r.notes}, ${r.consent_at})
      RETURNING *`;
    return normalise(rows[0]);
  }
  const m = mem();
  const now = new Date().toISOString();
  const row: AppointmentRequest = {
    ...r,
    id: ++m.seq,
    status: "requested",
    confirmed_date: null,
    confirmed_time: null,
    clinic_message: null,
    calendar_event_id: null,
    created_at: now,
    updated_at: now,
  };
  m.requests.unshift(row);
  return row;
}

export async function listRequests(status?: RequestStatus | "all"): Promise<AppointmentRequest[]> {
  if (sql) {
    const rows =
      !status || status === "all"
        ? await sql`SELECT * FROM appointment_requests ORDER BY created_at DESC LIMIT 500`
        : await sql`SELECT * FROM appointment_requests WHERE status = ${status} ORDER BY created_at DESC LIMIT 500`;
    return rows.map(normalise);
  }
  const all = mem().requests;
  return !status || status === "all" ? all : all.filter((r) => r.status === status);
}

export async function getRequest(id: number): Promise<AppointmentRequest | null> {
  if (sql) {
    const rows = await sql`SELECT * FROM appointment_requests WHERE id = ${id}`;
    return rows[0] ? normalise(rows[0]) : null;
  }
  return mem().requests.find((r) => r.id === id) ?? null;
}

export async function updateRequest(
  id: number,
  patch: Partial<Pick<AppointmentRequest, "status" | "confirmed_date" | "confirmed_time" | "clinic_message" | "calendar_event_id">>,
): Promise<AppointmentRequest | null> {
  const cur = await getRequest(id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  if (sql) {
    const rows = await sql`
      UPDATE appointment_requests SET
        status = ${next.status}, confirmed_date = ${next.confirmed_date}, confirmed_time = ${next.confirmed_time},
        clinic_message = ${next.clinic_message}, calendar_event_id = ${next.calendar_event_id}, updated_at = now()
      WHERE id = ${id} RETURNING *`;
    return normalise(rows[0]);
  }
  Object.assign(cur, patch, { updated_at: new Date().toISOString() });
  return cur;
}

/** Confirmed / rescheduled appointments on a date (used for overlap checks). */
export async function confirmedOn(date: string): Promise<AppointmentRequest[]> {
  if (sql) {
    const rows = await sql`SELECT * FROM appointment_requests
      WHERE status IN ('confirmed','rescheduled') AND confirmed_date = ${date}`;
    return rows.map(normalise);
  }
  return mem().requests.filter((r) => (r.status === "confirmed" || r.status === "rescheduled") && r.confirmed_date === date);
}

export async function listImportedReviews(): Promise<Review[]> {
  if (!sql) return [];
  try {
    const rows = await sql`SELECT * FROM imported_reviews ORDER BY review_date DESC NULLS LAST`;
    return rows.map((r) => ({
      id: String(r.id),
      author: String(r.author),
      rating: Number(r.rating),
      date: r.review_date ? toDateString(r.review_date) : null,
      text: String(r.text),
      source: "authorised-import" as const,
    }));
  } catch {
    return [];
  }
}

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

function toDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function normalise(row: Record<string, unknown>): AppointmentRequest {
  const r = row as unknown as AppointmentRequest;
  return {
    ...r,
    id: Number(r.id),
    preferred_date: toDateString(r.preferred_date),
    confirmed_date: r.confirmed_date ? toDateString(r.confirmed_date) : null,
    consent_at: new Date(r.consent_at as unknown as string).toISOString(),
    created_at: new Date(r.created_at as unknown as string).toISOString(),
    updated_at: new Date(r.updated_at as unknown as string).toISOString(),
  };
}
