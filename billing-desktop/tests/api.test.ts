import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer } from "../server/app";
import { decodeBackup, encodeBackup, isDue } from "../server/backup";

let srv: Awaited<ReturnType<typeof startServer>>;
let dir: string;
let extDir: string;

function client() {
  let cookie = "";
  return async (method: string, url: string, body?: unknown, extra: Record<string, string> = {}) => {
    const res = await fetch(srv.url + "/api" + url, {
      method,
      headers: { "content-type": "application/json", origin: srv.url, ...(cookie ? { cookie } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  };
}

const admin = client();
const reception = client();
const physio = client();
const ADMIN_PW = "Clinic-admin-2026";

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "npb-test-"));
  extDir = fs.mkdtempSync(path.join(os.tmpdir(), "npb-ext-"));
  srv = await startServer({ dataDir: dir, port: 0, scheduler: false });
});
afterAll(async () => {
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(extDir, { recursive: true, force: true });
});

describe("network hardening", () => {
  it("binds to loopback only", () => {
    expect(srv.url.startsWith("http://127.0.0.1:")).toBe(true);
  });
  it("rejects foreign Host headers (DNS rebinding)", async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(srv.url + "/api/auth/status", { headers: { host: "evil.example:80" } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end();
    });
    expect(status).toBe(421);
  });
  it("rejects cross-origin writes", async () => {
    const r = await admin("POST", "/auth/login", { username: "x", password: "y" }, { origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
});

describe("setup and authentication", () => {
  it("requires first-run setup with a strong password", async () => {
    expect((await admin("GET", "/auth/status")).body.needsSetup).toBe(true);
    expect((await admin("POST", "/auth/setup", { username: "sunil", displayName: "Dr. Sunil Kumar", password: "short" })).status).toBe(400);
    const r = await admin("POST", "/auth/setup", { username: "sunil", displayName: "Dr. Sunil Kumar", password: ADMIN_PW });
    expect(r.status).toBe(201);
    expect((await admin("POST", "/auth/setup", { username: "x2", displayName: "X", password: ADMIN_PW })).status).toBe(409);
  });
  it("blocks unauthenticated access", async () => {
    expect((await client()("GET", "/patients")).status).toBe(401);
  });
  it("creates staff who must change their temporary password", async () => {
    expect((await admin("POST", "/users", { username: "front", displayName: "Front Desk", role: "reception", temporaryPassword: "Temp-pass-111" })).status).toBe(201);
    expect((await admin("POST", "/users", { username: "physio2", displayName: "Physio Two", role: "physiotherapist", temporaryPassword: "Temp-pass-222" })).status).toBe(201);
    await reception("POST", "/auth/login", { username: "front", password: "Temp-pass-111" });
    expect((await reception("GET", "/patients")).body.code).toBe("MUST_CHANGE_PASSWORD");
    expect((await reception("POST", "/auth/change-password", { currentPassword: "Temp-pass-111", newPassword: "Front-desk-2026" })).status).toBe(200);
    expect((await reception("GET", "/patients")).status).toBe(200);
    await physio("POST", "/auth/login", { username: "physio2", password: "Temp-pass-222" });
    await physio("POST", "/auth/change-password", { currentPassword: "Temp-pass-222", newPassword: "Physio-two-2026" });
  });
  it("locks an account after repeated failures", async () => {
    const c = client();
    for (let i = 0; i < 5; i++) await c("POST", "/auth/login", { username: "physio2", password: "wrong-password-1" });
    const r = await c("POST", "/auth/login", { username: "physio2", password: "Physio-two-2026" });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/locked|Too many/);
  });
});

let patientId: number;
let invoiceId: number;

describe("patients, invoices and payments", () => {
  it("creates and searches patients", async () => {
    const r = await reception("POST", "/patients", { name: "Asha Rao", phone: "98450 12345", consentRecorded: true });
    expect(r.status).toBe(201);
    expect(r.body.code).toBe("NPC-P-00001");
    patientId = r.body.id;
    expect((await reception("POST", "/patients", { name: "A" })).status).toBe(400);
    const s = await reception("GET", "/patients?q=asha");
    expect(s.body.total).toBe(1);
  });

  it("restricts clinical notes to clinicians", async () => {
    expect((await physio("POST", `/patients/${patientId}/notes`, { note: "Post-op day 14, ROM 0-95°" })).status).toBe(201);
    expect((await reception("GET", `/patients/${patientId}/notes`)).status).toBe(403);
    expect((await admin("GET", `/patients/${patientId}/notes`)).body).toHaveLength(1);
  });

  it("calculates and numbers invoices server-side", async () => {
    const r = await reception("POST", "/invoices", {
      patientId,
      invoiceDate: "2026-11-21",
      items: [
        { description: "Physiotherapy session", quantity: 6, unitPrice: 80000, discount: 48000, taxRateBp: 1800 },
        { description: "Home visit charge", quantity: 1, unitPrice: 30000, discount: 0, taxRateBp: 0 },
      ],
      payment: { amount: 200000, method: "UPI", reference: "UPI123", paidOn: "2026-11-21" },
    });
    expect(r.status).toBe(201);
    expect(r.body.invoiceNo).toBe("NPC/2026-27/0001");
    expect(r.body.receipt.receiptNo).toBe("RCPT/2026-27/0001");
    invoiceId = r.body.id;
    const inv = (await reception("GET", `/invoices/${invoiceId}`)).body.invoice;
    // tax is disabled by default, so the 18% rate is ignored
    expect(inv.tax_total).toBe(0);
    expect(inv.total).toBe(6 * 80000 - 48000 + 30000);
    expect(inv.paid).toBe(200000);
    expect(inv.status).toBe("partial");
  });

  it("rejects overpayment, unknown methods and editing paid invoices", async () => {
    expect((await reception("POST", `/invoices/${invoiceId}/payments`, { amount: 99999999, method: "Cash", paidOn: "2026-11-21" })).status).toBe(400);
    expect((await reception("POST", `/invoices/${invoiceId}/payments`, { amount: 100, method: "Bitcoin", paidOn: "2026-11-21" })).status).toBe(400);
    expect((await reception("PUT", `/invoices/${invoiceId}`, { patientId, invoiceDate: "2026-11-21", items: [{ description: "x", quantity: 1, unitPrice: 1, discount: 0, taxRateBp: 0 }] })).status).toBe(409);
  });

  it("settles the balance and marks the invoice paid", async () => {
    const r = await reception("POST", `/invoices/${invoiceId}/payments`, { amount: 262000, method: "Cash", paidOn: "2026-11-22" });
    expect(r.status).toBe(201);
    expect((await reception("GET", `/invoices/${invoiceId}`)).body.invoice.status).toBe("paid");
  });

  it("applies tax only when enabled in settings", async () => {
    const s = (await admin("GET", "/settings")).body;
    s.tax.enabled = true;
    expect((await admin("PUT", "/settings", s)).status).toBe(200);
    const r = await admin("POST", "/invoices", { patientId, invoiceDate: "2026-11-22", items: [{ description: "Knee brace", quantity: 1, unitPrice: 100000, discount: 0, taxRateBp: 1200 }] });
    const inv = (await admin("GET", `/invoices/${r.body.id}`)).body.invoice;
    expect(inv.tax_total).toBe(12000);
    expect(inv.total).toBe(112000);
    expect(inv.invoice_no).toBe("NPC/2026-27/0002");
  });

  it("only admins can void, with a reason; void invoices leave outstanding totals", async () => {
    const list = (await admin("GET", "/invoices?status=unpaid")).body.items;
    const id = list[0].id;
    expect((await reception("POST", `/invoices/${id}/void`, { reason: "Entered twice" })).status).toBe(403);
    expect((await admin("POST", `/invoices/${id}/void`, { reason: "no" })).status).toBe(400);
    expect((await admin("POST", `/invoices/${id}/void`, { reason: "Entered twice by mistake" })).status).toBe(200);
    const dash = (await admin("GET", "/dashboard")).body;
    expect(dash.outstanding.s).toBe(0);
  });
});

describe("dashboard and reports", () => {
  it("computes dashboard figures from the database, hiding finances from non-admins", async () => {
    const d = (await admin("GET", "/dashboard")).body;
    expect(d.financial).toBe(true);
    expect(d.totalPatients).toBe(1);
    expect(d.trend).toHaveLength(12);
    expect((await reception("GET", "/dashboard")).body.financial).toBe(false);
    expect((await reception("GET", "/reports/revenue")).status).toBe(403);
  });
  it("reports revenue, services and methods", async () => {
    const rev = (await admin("GET", "/reports/revenue?from=2026-11-01&to=2026-11-30&group=day")).body;
    expect(rev.totals.collected).toBe(462000);
    expect(rev.totals.billed).toBe(462000);
    const m = (await admin("GET", "/reports/methods?from=2026-11-01&to=2026-11-30")).body;
    expect(m.rows.map((r: { method: string }) => r.method).sort()).toEqual(["Cash", "UPI"]);
    const sv = (await admin("GET", "/reports/services?from=2026-11-01&to=2026-11-30")).body;
    expect(sv.rows[0].service).toBe("Physiotherapy session");
  });
});

describe("appointments", () => {
  it("prevents double-booking a physiotherapist", async () => {
    const a = { patientId, visitType: "clinic", date: "2026-12-01", time: "10:00", physiotherapist: "Dr. Sunil Kumar", status: "confirmed" };
    expect((await reception("POST", "/appointments", a)).status).toBe(201);
    expect((await reception("POST", "/appointments", a)).status).toBe(409);
    expect((await reception("GET", "/appointments?from=2026-12-01&to=2026-12-01")).body).toHaveLength(1);
  });
});

describe("backups", () => {
  it("round-trips encode/decode and detects tampering", () => {
    const data = Buffer.from("SQLite format 3\0 pretend database");
    const enc = encodeBackup(data, { kind: "manual", schemaVersion: 1, passphrase: "correct horse battery" });
    expect(decodeBackup(enc, "correct horse battery").dbBytes.equals(data)).toBe(true);
    expect(() => decodeBackup(enc, "wrong passphrase!!")).toThrow(/passphrase/);
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 3] ^= 0xff;
    expect(() => decodeBackup(tampered, "correct horse battery")).toThrow();
  });

  it("schedules daily backups once per day after the set time", () => {
    const now = new Date(2026, 10, 21, 20, 30);
    expect(isDue("daily", "20:00", null, now)).toBe(true);
    expect(isDue("daily", "20:00", new Date(2026, 10, 21, 20, 5).toISOString(), now)).toBe(false);
    expect(isDue("daily", "21:00", null, now)).toBe(false);
    expect(isDue("off", "20:00", null, now)).toBe(false);
  });

  it("refuses encrypted backups until a passphrase is set, then backs up to every destination", async () => {
    expect((await admin("POST", "/backups")).status).toBe(400);
    expect((await admin("POST", "/backups/passphrase", { passphrase: "a-long-backup-passphrase", adminPassword: "wrong" })).status).toBe(403);
    expect((await admin("POST", "/backups/passphrase", { passphrase: "a-long-backup-passphrase", adminPassword: ADMIN_PW })).status).toBe(200);
    const s = (await admin("GET", "/settings")).body;
    s.backup.destinations = [extDir];
    await admin("PUT", "/settings", s);
    const r = await admin("POST", "/backups");
    expect(r.status).toBe(201);
    expect(r.body.results).toHaveLength(2);
    expect(r.body.results.every((x: { ok: boolean }) => x.ok)).toBe(true);
    expect(fs.readdirSync(extDir).some((f) => f.endsWith(".npcbak"))).toBe(true);
  });

  it("verifies and restores a backup after a safety backup", async () => {
    const list = (await admin("GET", "/backups")).body;
    const file = list.find((b: { destination: string }) => b.destination === extDir).file;
    const v = await admin("POST", "/backups/verify", { file, passphrase: "a-long-backup-passphrase" });
    expect(v.body.ok).toBe(true);
    expect(v.body.patients).toBe(1);
    expect((await admin("POST", "/backups/verify", { file, passphrase: "nope-nope-nope" })).body.ok).toBe(false);

    // Change data after the backup, then restore and confirm it is gone.
    await admin("POST", "/patients", { name: "Created After Backup" });
    expect((await admin("GET", "/patients")).body.total).toBe(2);
    expect((await reception("POST", "/backups/restore", { file, passphrase: "a-long-backup-passphrase", adminPassword: ADMIN_PW })).status).toBe(403);
    const r = await admin("POST", "/backups/restore", { file, passphrase: "a-long-backup-passphrase", adminPassword: ADMIN_PW });
    expect(r.status).toBe(200);
    expect(r.body.safetyBackup).toMatch(/pre-restore/);
    expect((await admin("GET", "/patients")).body.total).toBe(1);
  });
});

describe("privacy workflow", () => {
  it("anonymises patients with financial records and logs it", async () => {
    expect((await reception("DELETE", `/patients/${patientId}`, { reason: "Patient requested erasure" })).status).toBe(403);
    const r = await admin("DELETE", `/patients/${patientId}`, { reason: "Patient requested erasure" });
    expect(r.body.mode).toBe("anonymised");
    const p = (await admin("GET", `/patients/${patientId}`)).body;
    expect(p.patient.name).toMatch(/^Anonymised patient/);
    expect(p.patient.phone).toBeNull();
    expect(p.invoices.length).toBeGreaterThan(0);
    expect((await admin("GET", `/patients/${patientId}/notes`)).body).toHaveLength(0);
    const audit = (await admin("GET", "/audit?q=patient.anonymise")).body;
    expect(audit).toHaveLength(1);
  });
});
