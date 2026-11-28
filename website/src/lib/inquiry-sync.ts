import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getToken, setToken, type SyncedInquiry } from "@/lib/db";

const PROVIDER = "inquiry_sync_tokens";
const MAX_ACTIVE_TOKENS = 10;

type StoredSyncToken = {
  id: string;
  label: string;
  hash: string;
  createdAt: string;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashesEqual(aHex: string, bHex: string): boolean {
  if (aHex.length !== 64 || bHex.length !== 64) return false;
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readStoredTokens(): Promise<StoredSyncToken[]> {
  try {
    const raw = await getToken(PROVIDER);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StoredSyncToken =>
        !!x && typeof x.id === "string" && typeof x.hash === "string" && x.hash.length === 64,
    );
  } catch {
    return [];
  }
}

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
  return m && m[1].length >= 20 ? m[1] : null;
}

export async function verifySyncBearer(authHeader: string | null): Promise<boolean> {
  const token = extractBearer(authHeader);
  if (!token) return false;
  const candidateHash = sha256Hex(token);

  const envToken = process.env.INQUIRY_SYNC_TOKEN?.trim();
  if (envToken && envToken.length >= 20 && hashesEqual(candidateHash, sha256Hex(envToken))) {
    return true;
  }

  const stored = await readStoredTokens();
  let matched = false;
  for (const entry of stored) {
    if (hashesEqual(candidateHash, entry.hash)) matched = true;
  }
  return matched;
}

export async function issueSyncToken(label = "Clinic billing desktop"): Promise<string> {
  const token = `npc_sync_${randomBytes(32).toString("base64url")}`;
  const existing = await readStoredTokens();
  const next: StoredSyncToken[] = [
    {
      id: randomBytes(6).toString("hex"),
      label: label.trim().slice(0, 80) || "Clinic billing desktop",
      hash: sha256Hex(token),
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, MAX_ACTIVE_TOKENS);
  await setToken(PROVIDER, JSON.stringify(next));
  return token;
}

/**
 * Optional instant push notification to a configured billing webhook endpoint
 * (e.g. local development or LAN relay). Never blocks or fails inquiry storage
 * when the local billing software is offline.
 */
export async function notifyBillingWebhook(inquiry: SyncedInquiry): Promise<void> {
  const webhookUrl = process.env.BILLING_WEBHOOK_URL?.trim();
  const envToken = process.env.INQUIRY_SYNC_TOKEN?.trim();
  if (!webhookUrl || !envToken) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${envToken}`,
      },
      body: JSON.stringify({ inquiry }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Expected whenever the local billing software is offline; cursor sync catches up on reconnect.
  }
}
