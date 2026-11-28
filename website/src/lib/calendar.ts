import "server-only";
import { decrypt, encrypt, oauthEncryptionConfigured } from "./crypto";
import { getToken, setToken, type AppointmentRequest } from "./db";

/**
 * Optional Google Calendar integration (server-side only).
 * The clinic owner connects their own calendar from /admin via OAuth.
 * Event titles/descriptions intentionally exclude medical details.
 */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
const PROVIDER = "google-calendar";
export const CLINIC_TIMEZONE = "Asia/Kolkata";

export function calendarConfigured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      oauthEncryptionConfigured(),
  );
}

const calendarId = () => encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary");
const redirectUri = () => `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/calendar/callback`;

export function googleCalendarDayUrl(date: string): string {
  const [y, m, d] = date.split("-").map((v) => Number(v));
  if (!y || !m || !d) return "https://calendar.google.com/calendar/u/0/r";
  return `https://calendar.google.com/calendar/u/0/r/day/${y}/${m}/${d}`;
}

export function authUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const j = (await res.json()) as { refresh_token?: string };
  if (!j.refresh_token) {
    throw new Error("Google did not return a refresh token. Remove the app's access in your Google account and connect again.");
  }
  await setToken(PROVIDER, encrypt(j.refresh_token));
}

export async function isCalendarConnected() {
  return calendarConfigured() && Boolean(await getToken(PROVIDER));
}

export async function disconnectCalendar() {
  await setToken(PROVIDER, null);
}

async function accessToken(): Promise<string | null> {
  if (!calendarConfigured()) return null;
  const blob = await getToken(PROVIDER);
  if (!blob) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: decrypt(blob),
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Calendar token refresh failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Builds an RFC3339 timestamp in IST for a date + HH:MM. */
export function istDateTime(date: string, time: string) {
  return `${date}T${time}:00+05:30`;
}

export function addMinutes(date: string, time: string, minutes: number) {
  const d = new Date(istDateTime(date, time));
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

/** Returns true if the calendar has any busy block overlapping the slot. */
export async function calendarBusy(date: string, time: string, minutes: number): Promise<boolean | null> {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: new Date(istDateTime(date, time)).toISOString(),
      timeMax: addMinutes(date, time, minutes),
      timeZone: CLINIC_TIMEZONE,
      items: [{ id: decodeURIComponent(calendarId()) }],
    }),
  });
  if (!res.ok) throw new Error(`Calendar availability check failed (${res.status})`);
  const j = (await res.json()) as { calendars: Record<string, { busy: { start: string; end: string }[] }> };
  return Object.values(j.calendars).some((c) => c.busy?.length > 0);
}

/** Retrieves busy intervals across the whole IST day so the approval screen can display busy windows. */
export async function calendarDayBusyWindows(
  date: string,
): Promise<{ connected: boolean; busy: { start: string; end: string }[]; error?: string }> {
  try {
    const token = await accessToken();
    if (!token) return { connected: false, busy: [] };
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: new Date(`${date}T00:00:00+05:30`).toISOString(),
        timeMax: new Date(`${date}T23:59:59+05:30`).toISOString(),
        timeZone: CLINIC_TIMEZONE,
        items: [{ id: decodeURIComponent(calendarId()) }],
      }),
    });
    if (!res.ok) return { connected: true, busy: [], error: `Calendar API returned ${res.status}` };
    const j = (await res.json()) as { calendars: Record<string, { busy: { start: string; end: string }[] }> };
    const busy = Object.values(j.calendars).flatMap((c) => c.busy ?? []);
    return { connected: true, busy };
  } catch (e) {
    return { connected: true, busy: [], error: (e as Error).message };
  }
}

function eventBody(r: AppointmentRequest, date: string, time: string, minutes: number) {
  const kind = r.visit_type === "home" ? "Home visit" : "Clinic visit";
  return {
    // Privacy-safe: no diagnosis or clinical notes stored in Google Calendar
    summary: `${kind} · ${r.reference}`,
    description: `Physiotherapy appointment (${kind.toLowerCase()}).\nReference: ${r.reference}\nManaged via Namma Physiotherapy Centre website.`,
    location:
      r.visit_type === "home"
        ? [r.locality, r.pin_code].filter(Boolean).join(" ")
        : "Namma Physiotherapy Centre, JP Nagar 8th Phase, Bengaluru",
    start: { dateTime: istDateTime(date, time), timeZone: CLINIC_TIMEZONE },
    end: { dateTime: addMinutes(date, time, minutes), timeZone: CLINIC_TIMEZONE },
    visibility: "private",
  };
}

export async function upsertEvent(r: AppointmentRequest, date: string, time: string, minutes: number): Promise<string | null> {
  const token = await accessToken();
  if (!token) return null;
  const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events`;
  const res = await fetch(r.calendar_event_id ? `${base}/${encodeURIComponent(r.calendar_event_id)}` : base, {
    method: r.calendar_event_id ? "PUT" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody(r, date, time, minutes)),
  });
  if (!res.ok) throw new Error(`Calendar event save failed (${res.status})`);
  return ((await res.json()) as { id: string }).id;
}

export async function deleteEvent(eventId: string) {
  const token = await accessToken();
  if (!token) return;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar event delete failed (${res.status})`);
  }
}
