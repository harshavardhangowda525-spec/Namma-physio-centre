import type { DB } from "./db";

/** Optional OS-backed secret protection (Electron safeStorage / Windows DPAPI). */
export type SecretStore = {
  available: boolean;
  encrypt(plain: string): string;
  decrypt(blob: string): string;
};

export type Ctx = {
  db: DB;
  dbFile: string;
  dataDir: string;
  secretStore: SecretStore;
  /** Re-opens the database after a restore. */
  reopen(): void;
};

/** Fallback used outside Electron (development). Not OS-protected. */
export const plainSecretStore: SecretStore = {
  available: false,
  encrypt: (s) => "plain:" + Buffer.from(s, "utf8").toString("base64"),
  decrypt: (b) => Buffer.from(b.replace(/^plain:/, ""), "base64").toString("utf8"),
};
