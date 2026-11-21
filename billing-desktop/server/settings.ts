import { z } from "zod";
import type { DB } from "./db";

export const settingsSchema = z.object({
  clinic: z.object({
    name: z.string().min(1).max(120),
    tagline: z.string().max(160),
    address: z.string().max(400),
    phone: z.string().max(40),
    email: z.string().max(120),
    gstin: z.string().max(20),
    registrationNote: z.string().max(200),
    logoDataUrl: z.string().max(700_000).nullable(), // small PNG/JPEG stored inline
  }),
  invoice: z.object({
    prefix: z.string().min(1).max(12).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
    receiptPrefix: z.string().min(1).max(12).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
    padding: z.number().int().min(3).max(8),
    resetEachFinancialYear: z.boolean(),
    footerNote: z.string().max(500),
    terms: z.string().max(1000),
    showSignature: z.boolean(),
    showStamp: z.boolean(),
    defaultFormat: z.enum(["a4", "receipt"]),
  }),
  tax: z.object({
    enabled: z.boolean(),
    label: z.string().max(20),
    defaultRateBp: z.number().int().min(0).max(5000),
    note: z.string().max(200),
  }),
  paymentMethods: z.array(z.string().min(1).max(40)).min(1).max(20),
  physiotherapists: z.array(z.string().min(1).max(80)).max(30),
  backup: z.object({
    schedule: z.enum(["off", "daily", "every6h", "every12h"]),
    dailyTime: z.string().regex(/^\d{2}:\d{2}$/),
    destinations: z.array(z.string().max(500)).max(4),
    keep: z.number().int().min(3).max(365),
    encrypt: z.boolean(),
  }),
  privacy: z.object({
    retentionYears: z.number().int().min(1).max(50),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = {
  clinic: {
    name: "Namma Physio Centre",
    tagline: "Physiotherapy & Rehabilitation",
    address: "1st Cross, No. 5, Jambusawari Dinne Main Road, Kothnur, Royal County, 8th Phase, J. P. Nagar, Bengaluru, Karnataka 560083",
    phone: "+91 99164 53616",
    email: "",
    gstin: "",
    registrationNote: "",
    logoDataUrl: null,
  },
  invoice: {
    prefix: "NPC",
    receiptPrefix: "RCPT",
    padding: 4,
    resetEachFinancialYear: true,
    footerNote: "Thank you for choosing Namma Physio Centre. Wishing you a smooth recovery.",
    terms: "This is a computer-generated document.",
    showSignature: true,
    showStamp: true,
    defaultFormat: "a4",
  },
  // Many healthcare services are GST-exempt; tax is OFF by default. Confirm with your accountant.
  tax: { enabled: false, label: "GST", defaultRateBp: 0, note: "" },
  paymentMethods: ["Cash", "UPI", "Bank transfer", "Card"],
  physiotherapists: ["Dr. Sunil Kumar"],
  backup: { schedule: "daily", dailyTime: "20:00", destinations: [], keep: 30, encrypt: true },
  privacy: { retentionYears: 7 },
};

const KEY = "app_settings";

export function getSettings(db: DB): Settings {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(KEY) as { value: string } | undefined;
  if (!row) return structuredClone(defaultSettings);
  const stored = JSON.parse(row.value);
  // Deep-merge with defaults so new settings keys get sensible values after upgrades.
  const merged = Object.fromEntries(
    Object.entries(defaultSettings).map(([k, v]) => [k, Array.isArray(v) ? stored[k] ?? v : { ...(v as object), ...(stored[k] ?? {}) }]),
  );
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : structuredClone(defaultSettings);
}

export function saveSettings(db: DB, s: Settings) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(KEY, JSON.stringify(s));
}

/** Simple key/value state (counters, secrets, timestamps). */
export function getKV(db: DB, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
export function setKV(db: DB, key: string, value: string | null) {
  if (value === null) db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  else db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
