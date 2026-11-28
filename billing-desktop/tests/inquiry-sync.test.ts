import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer } from "../server/app";
import { getKV } from "../server/settings";

type MockInquiry = {
  id: number;
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
  created_at: string;
};

describe("website appointment inquiry synchronization", () => {
  let billingSrv: Awaited<ReturnType<typeof startServer>>;
  let dataDir: string;
  let webSrv: http.Server;
  let webUrl = "";

  const WEBSITE_ADMIN_PW = "Website-Admin-Pass-2026";
  const tokenHashes = new Set<string>();
  const remoteInquiries: MockInquiry[] = [];
  let seq = 0;
  let simulateOffline = false;

  const sha256 = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

  function addWebsiteInquiry(partial: Omit<MockInquiry, "id" | "reference"> & { reference?: string }): MockInquiry {
    const item: MockInquiry = {
      id: ++seq,
      reference: partial.reference ?? `NPC-261125-T00${seq}`,
      ...partial,
    };
    remoteInquiries.push(item);
    return item;
  }

  function makeClient() {
    let cookie = "";
    return async (method: string, route: string, body?: unknown, extraHeaders: Record<string, string> = {}) => {
      const res = await fetch(billingSrv.url + "/api" + route, {
        method,
        headers: {
          "content-type": "application/json",
          origin: billingSrv.url,
          ...(cookie ? { cookie } : {}),
          ...extraHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const json = await res.json().catch(() => null);
      return { status: res.status, body: json };
    };
  }

  const admin = makeClient();
  const reception = makeClient();

  beforeAll(async () => {
    webSrv = http.createServer((req, res) => {
      if (simulateOffline) {
        req.socket.destroy();
        return;
      }
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "POST" && url.pathname === "/api/inquiries/pair") {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          const parsed = JSON.parse(raw || "{}");
          if (parsed.password !== WEBSITE_ADMIN_PW) {
            res.writeHead(401, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: "Incorrect website admin password" }));
            return;
          }
          const token = `npc_sync_${crypto.randomBytes(32).toString("base64url")}`;
          tokenHashes.add(sha256(token));
          res.writeHead(201, { "content-type": "application/json" });
          res.end(JSON.stringify({ token }));
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/inquiries/sync") {
        const auth = req.headers.authorization ?? "";
        const m = /^Bearer\s+(\S+)$/i.exec(auth);
        if (!m || !tokenHashes.has(sha256(m[1]))) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized sync token" }));
          return;
        }
        const afterId = Number(url.searchParams.get("after_id") ?? "0");
        const limit = Number(url.searchParams.get("limit") ?? "200");
        const batch = remoteInquiries
          .filter((x) => x.id > afterId)
          .sort((a, b) => a.id - b.id)
          .slice(0, limit);
        const nextCursor = batch.reduce((mx, x) => Math.max(mx, x.id), afterId);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            inquiries: batch,
            nextCursor,
            hasMore: batch.length >= limit,
            serverTime: new Date().toISOString(),
          }),
        );
        return;
      }

      res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => webSrv.listen(0, "127.0.0.1", () => resolve()));
    webUrl = `http://127.0.0.1:${(webSrv.address() as AddressInfo).port}`;

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "npb-inq-test-"));
    billingSrv = await startServer({
      dataDir,
      port: 0,
      scheduler: false,
      inquirySync: true,
      inquirySyncIntervalMs: 120,
    });

    await admin("POST", "/auth/setup", {
      username: "admin",
      displayName: "Dr. Sunil Kumar",
      password: "Clinic-admin-2026",
    });
    await admin("POST", "/users", {
      username: "desk",
      displayName: "Reception",
      role: "reception",
      temporaryPassword: "Temp-desk-2026",
    });
    await reception("POST", "/auth/login", { username: "desk", password: "Temp-desk-2026" });
    await reception("POST", "/auth/change-password", {
      currentPassword: "Temp-desk-2026",
      newPassword: "Desk-active-2026",
    });
  }, 15_000);

  afterAll(async () => {
    await billingSrv?.close();
    await new Promise<void>((resolve) => webSrv?.close(() => resolve()));
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("enforces HTTPS for remote hosts, protects credentials, and restricts pairing to admins", async () => {
    const httpRemote = await admin("POST", "/inquiries/connect", {
      websiteUrl: "http://example.com",
      password: WEBSITE_ADMIN_PW,
    });
    expect(httpRemote.status).toBe(400);
    expect(httpRemote.body.error).toMatch(/HTTPS/i);

    const forbidden = await reception("POST", "/inquiries/connect", {
      websiteUrl: webUrl,
      password: WEBSITE_ADMIN_PW,
    });
    expect(forbidden.status).toBe(403);

    const wrongPw = await admin("POST", "/inquiries/connect", {
      websiteUrl: webUrl,
      password: "wrong-password",
    });
    expect(wrongPw.status).toBe(401);
  });

  it("pairs with the website, encrypts the sync token at rest, and syncs existing inquiries with all fields", async () => {
    addWebsiteInquiry({
      visit_type: "clinic",
      patient_name: "Ananya Sharma",
      mobile: "9845011223",
      email: "ananya@example.com",
      address: null,
      locality: null,
      pin_code: null,
      preferred_date: "2026-11-28",
      preferred_time: "Late morning (10 AM – 12 PM)",
      reason: "Shoulder stiffness",
      notes: "Pain when lifting arm overhead",
      consent_at: "2026-11-25T09:00:00.000Z",
      created_at: "2026-11-25T09:00:01.000Z",
    });

    const connected = await admin("POST", "/inquiries/connect", {
      websiteUrl: webUrl,
      password: WEBSITE_ADMIN_PW,
    });
    expect(connected.status).toBe(200);
    expect(connected.body.added).toBe(1);
    expect(connected.body.status.configured).toBe(true);
    expect(JSON.stringify(connected.body)).not.toContain("npc_sync_");

    // Token in SQLite KV is encoded via secretStore rather than raw token string
    const rawKv = getKV(billingSrv.ctx.db, "inquiry_sync_token");
    expect(rawKv).toBeTruthy();
    expect(rawKv!.startsWith("npc_sync_")).toBe(false);

    const list = await reception("GET", "/inquiries");
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      reference: "NPC-261125-T001",
      visitType: "clinic",
      patientName: "Ananya Sharma",
      mobile: "9845011223",
      email: "ananya@example.com",
      preferredDate: "2026-11-28",
      preferredTime: "Late morning (10 AM – 12 PM)",
      reason: "Shoulder stiffness",
      notes: "Pain when lifting arm overhead",
      consentAt: "2026-11-25T09:00:00.000Z",
      submittedAt: "2026-11-25T09:00:01.000Z",
    });
  });

  it("retains inquiries while offline and automatically synchronizes them on reconnect with latest at top", async () => {
    simulateOffline = true;

    // Submitted while local billing software is offline
    addWebsiteInquiry({
      visit_type: "home",
      patient_name: "Karthik Gowda",
      mobile: "9900122334",
      email: null,
      address: "Flat 302, Green View Residency, 4th Main",
      locality: "JP Nagar 8th Phase",
      pin_code: "560083",
      preferred_date: "2026-11-29",
      preferred_time: "Early afternoon (12 – 2 PM)",
      reason: "Post-TKR home rehabilitation",
      notes: "Lift available in apartment",
      consent_at: "2026-11-25T10:15:00.000Z",
      created_at: "2026-11-25T10:15:02.000Z",
    });

    addWebsiteInquiry({
      visit_type: "clinic",
      patient_name: "Meera Nair",
      mobile: "9886099887",
      email: "meera.nair@example.com",
      address: null,
      locality: null,
      pin_code: null,
      preferred_date: "2026-11-30",
      preferred_time: "Evening (after 5 PM)",
      reason: "Knee osteoarthritis pain",
      notes: null,
      consent_at: "2026-11-25T11:30:00.000Z",
      created_at: "2026-11-25T11:30:05.000Z",
    });

    // Sync attempt while offline fails gracefully without losing existing local inquiries
    const offlineSync = await admin("POST", "/inquiries/sync");
    expect(offlineSync.status).toBe(200);
    expect(offlineSync.body.status.state).toBe("offline");

    // Reconnect internet — background poller automatically catches up without manual intervention
    simulateOffline = false;
    await new Promise((r) => setTimeout(r, 350));

    const afterReconnect = await reception("GET", "/inquiries");
    expect(afterReconnect.status).toBe(200);
    expect(afterReconnect.body.total).toBe(3);
    expect(afterReconnect.body.sync.state).toBe("idle");

    // Latest inquiry (Meera, 11:30) is first; Karthik (10:15) second; Ananya (09:00) third
    expect(afterReconnect.body.items.map((x: { patientName: string }) => x.patientName)).toEqual([
      "Meera Nair",
      "Karthik Gowda",
      "Ananya Sharma",
    ]);

    // Home visit fields are preserved completely
    expect(afterReconnect.body.items[1]).toMatchObject({
      visitType: "home",
      address: "Flat 302, Green View Residency, 4th Main",
      locality: "JP Nagar 8th Phase",
      pinCode: "560083",
    });
  });

  it("prevents duplicate entries across webhook pushes and repeated full re-syncs", async () => {
    // Unauthorized webhook is rejected
    const badHook = await fetch(billingSrv.url + "/api/inquiries/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer invalid_token_123456789012345" },
      body: JSON.stringify({ inquiry: remoteInquiries[0] }),
    });
    expect(badHook.status).toBe(401);

    // Re-pairing resets cursor to 0 and re-reads all 3 remote inquiries -> 0 duplicates added
    const resync = await admin("POST", "/inquiries/connect", {
      websiteUrl: webUrl,
      password: WEBSITE_ADMIN_PW,
    });
    expect(resync.status).toBe(200);
    expect(resync.body.added).toBe(0);
    expect(resync.body.status.totalInquiries).toBe(3);
  });
});
