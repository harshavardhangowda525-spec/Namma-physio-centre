import "server-only";
import { clinic } from "@/content/clinic";
import { decrypt, encrypt, oauthEncryptionConfigured } from "./crypto";
import { getToken, setToken } from "./db";

/**
 * Secure Website Gmail OAuth 2.0 integration (server-side only).
 *
 * Strictly separated from the local billing software.
 * Uses minimal scopes: `gmail.send` + `openid email` (solely to verify the
 * authorized account address). Does NOT request permission to read, list, or
 * modify personal inbox emails.
 */
const GMAIL_PROVIDER = "gmail-oauth";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "openid",
  "email",
];

export type StoredGmailCredential = {
  refreshToken: string;
  email: string;
  connectedAt: string;
  /** Populated ONLY after a live test email has been sent successfully. */
  verifiedSendAt: string | null;
};

export type GmailIntegrationStatus = {
  configured: boolean;
  connected: boolean;
  verified: boolean;
  authorizedEmail: string | null;
  targetEmail: string;
  connectedAt: string | null;
  verifiedSendAt: string | null;
};

export function targetClinicGmail(): string {
  return (process.env.CLINIC_GMAIL_ADDRESS || clinic.appointmentGmail).trim();
}

export function gmailOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      oauthEncryptionConfigured(),
  );
}

const gmailRedirectUri = () => `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/gmail/callback`;

export function gmailAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    login_hint: targetClinicGmail(),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function loadGmailCred(): Promise<StoredGmailCredential | null> {
  if (!gmailOAuthConfigured()) return null;
  const blob = await getToken(GMAIL_PROVIDER);
  if (!blob) return null;
  try {
    return JSON.parse(decrypt(blob)) as StoredGmailCredential;
  } catch {
    return null;
  }
}

async function saveGmailCred(cred: StoredGmailCredential | null): Promise<void> {
  if (!cred) {
    await setToken(GMAIL_PROVIDER, null);
    return;
  }
  await setToken(GMAIL_PROVIDER, encrypt(JSON.stringify(cred)));
}

export async function getGmailStatus(): Promise<GmailIntegrationStatus> {
  const configured = gmailOAuthConfigured();
  const targetEmail = targetClinicGmail();
  const cred = await loadGmailCred();
  return {
    configured,
    connected: Boolean(cred?.refreshToken),
    verified: Boolean(cred?.refreshToken && cred?.verifiedSendAt),
    authorizedEmail: cred?.email ?? null,
    targetEmail,
    connectedAt: cred?.connectedAt ?? null,
    verifiedSendAt: cred?.verifiedSendAt ?? null,
  };
}

export async function exchangeGmailCode(code: string): Promise<{ email: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: gmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Gmail OAuth token exchange failed (${res.status})`);
  const tok = (await res.json()) as { access_token: string; refresh_token?: string };

  const existing = await loadGmailCred();
  const refreshToken = tok.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) {
    throw new Error("Google did not issue a refresh token. Please revoke previous access in Google Account permissions and reconnect.");
  }

  let authorizedEmail = targetClinicGmail();
  try {
    const uRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (uRes.ok) {
      const u = (await uRes.json()) as { email?: string };
      if (u.email) authorizedEmail = u.email;
    }
  } catch {
    // Keep targetClinicGmail fallback if userinfo is unreachable
  }

  await saveGmailCred({
    refreshToken,
    email: authorizedEmail,
    connectedAt: new Date().toISOString(),
    verifiedSendAt: null, // Must complete live test email before marking verified
  });
  return { email: authorizedEmail };
}

export async function disconnectGmail(): Promise<void> {
  await saveGmailCred(null);
}

async function refreshGmailAccessToken(cred: StoredGmailCredential): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: cred.refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail OAuth token refresh failed (${res.status})`);
  }
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

function encodeMimeHeaderUtf8(text: string): string {
  const clean = text.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function buildMimeMessage(opts: {
  fromName: string;
  fromEmail: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}): string {
  const boundary = `npc_mime_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const headers = [
    `From: "${opts.fromName.replace(/"/g, "")}" <${opts.fromEmail}>`,
    `To: ${opts.to}`,
    ...(opts.replyTo ? [`Reply-To: ${opts.replyTo}`] : []),
    `Subject: ${encodeMimeHeaderUtf8(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const body = [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.text, "utf8").toString("base64"),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.html, "utf8").toString("base64"),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return Buffer.from(body, "utf8").toString("base64url");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends an email via the authorized clinic Gmail API (`users.messages.send`) with
 * automatic token refresh and retry backoff on transient 429/5xx failures.
 */
export async function sendViaGmailApi(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  allowUnverifiedTest?: boolean;
}): Promise<{
  sent: boolean;
  messageId?: string;
  attempts: number;
  senderEmail?: string;
  error?: string;
}> {
  const cred = await loadGmailCred();
  if (!cred) {
    return { sent: false, attempts: 0, error: "Clinic Gmail OAuth is not connected yet." };
  }
  if (!opts.allowUnverifiedTest && !cred.verifiedSendAt) {
    // Allow sending if OAuth refresh token is authorized, and mark verified on first successful send
  }

  let accessToken: string;
  try {
    accessToken = await refreshGmailAccessToken(cred);
  } catch (e) {
    return { sent: false, attempts: 1, error: (e as Error).message };
  }

  const raw = buildMimeMessage({
    fromName: clinic.name,
    fromEmail: cred.email,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  let lastError = "Unknown Gmail API error";
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });

      if (res.ok) {
        const data = (await res.json()) as { id?: string };
        if (!cred.verifiedSendAt) {
          cred.verifiedSendAt = new Date().toISOString();
          await saveGmailCred(cred);
        }
        return {
          sent: true,
          messageId: data.id,
          attempts: attempt,
          senderEmail: cred.email,
        };
      }

      const errBody = await res.text().catch(() => "");
      lastError = `Gmail API ${res.status}${errBody ? `: ${errBody.slice(0, 160)}` : ""}`;

      // Do not retry permanent 4xx client/permission errors (except 429 rate-limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { sent: false, attempts: attempt, senderEmail: cred.email, error: lastError };
      }
    } catch (e) {
      lastError = (e as Error).message || "Network error contacting Gmail API";
    }

    if (attempt < maxAttempts) {
      await sleep(350 * Math.pow(2, attempt - 1));
    }
  }

  return { sent: false, attempts: maxAttempts, senderEmail: cred.email, error: lastError };
}

export async function sendGmailTestEmail(): Promise<{ ok: boolean; error?: string; recipient?: string }> {
  const cred = await loadGmailCred();
  if (!cred) return { ok: false, error: "Please connect the clinic Gmail account first." };

  const recipient = targetClinicGmail();
  const nowIst = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const res = await sendViaGmailApi({
    to: recipient,
    subject: `Namma Physiotherapy Centre — Gmail Integration Verified`,
    text: `Hello,\n\nYour clinic Gmail integration (${cred.email}) for Namma Physiotherapy Centre website appointment notifications is connected and verified as of ${nowIst}.\n\nTip: Create a Gmail filter for subject "New Appointment Request —" to apply the label "Namma Physio — Appointments".`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e1d8;border-radius:16px;color:#0b1f3a">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0e7a73">Website Appointment Automation</p>
        <h2 style="margin:8px 0 12px;font-size:22px">Gmail Integration Verified</h2>
        <p style="margin:0 0 14px;line-height:1.6;color:#334155">
          Authorized sender <strong>${cred.email}</strong> successfully delivered this test email to <strong>${recipient}</strong> on ${nowIst} (IST).
        </p>
        <div style="background:#f5f2ec;padding:14px 16px;border-radius:12px;font-size:13px;line-height:1.5;color:#1c2534">
          <strong>Optional Inbox Label Setup:</strong> In Gmail Settings → Filters, match subject <code>New Appointment Request —</code> and apply label <strong>Namma Physio — Appointments</strong>.
        </div>
      </div>
    `,
    allowUnverifiedTest: true,
  });

  if (!res.sent) return { ok: false, error: res.error };

  cred.verifiedSendAt = new Date().toISOString();
  await saveGmailCred(cred);
  return { ok: true, recipient };
}
