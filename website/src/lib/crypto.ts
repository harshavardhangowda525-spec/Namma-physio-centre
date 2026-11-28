import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function resolveHexKey(): string | undefined {
  const k = process.env.OAUTH_TOKEN_ENCRYPTION_KEY || process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  return k && /^[0-9a-f]{64}$/i.test(k) ? k : undefined;
}

export function oauthEncryptionConfigured(): boolean {
  return Boolean(resolveHexKey());
}

function key(): Buffer {
  const hex = resolveHexKey();
  if (!hex) {
    throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY (or CALENDAR_TOKEN_ENCRYPTION_KEY) must be 64 hex characters");
  }
  return Buffer.from(hex, "hex");
}

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decrypt(blob: string): string {
  const b = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function generateOpaqueToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "unknown";
  const [local, domain] = email.split("@");
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`;
}
