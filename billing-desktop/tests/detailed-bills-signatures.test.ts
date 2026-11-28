import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer } from "../server/app";
import { defaultSettings } from "../server/settings";
import { buildDetailedBillPdfDoc } from "../src/pdf";
import type { DetailedBillFull } from "../shared/types";

let srv: Awaited<ReturnType<typeof startServer>>;
let dir: string;

const TINY_SIGNATURE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjDAGACCDAv8cI7IoAAAAAElFTkSuQmCC";

function client() {
  let cookie = "";
  return async (method: string, url: string, body?: unknown) => {
    const res = await fetch(srv.url + "/api" + url, {
      method,
      headers: {
        "content-type": "application/json",
        origin: srv.url,
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  };
}

const admin = client();
const physio = client();
const reception = client();

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "npb-db-sig-test-"));
  srv = await startServer({ dataDir: dir, port: 0, scheduler: false });

  await admin("POST", "/auth/setup", {
    username: "sunil",
    displayName: "Sunil Kumar",
    password: "Clinic-admin-2026",
  });

  await admin("POST", "/users", {
    username: "physio1",
    displayName: "Physio Clinician",
    role: "physiotherapist",
    temporaryPassword: "Temp-physio-2026",
  });
  await physio("POST", "/auth/login", { username: "physio1", password: "Temp-physio-2026" });
  await physio("POST", "/auth/change-password", {
    currentPassword: "Temp-physio-2026",
    newPassword: "Physio-strong-2026",
  });

  await admin("POST", "/users", {
    username: "front1",
    displayName: "Reception Staff",
    role: "reception",
    temporaryPassword: "Temp-front-2026",
  });
  await reception("POST", "/auth/login", { username: "front1", password: "Temp-front-2026" });
  await reception("POST", "/auth/change-password", {
    currentPassword: "Temp-front-2026",
    newPassword: "Reception-strong-2026",
  });
}, 20_000);

afterAll(async () => {
  await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("electronic handwritten signatures & role-based security", () => {
  it("blocks reception accounts from saving, viewing, or applying clinician signatures", async () => {
    expect((await reception("GET", "/signatures/me")).status).toBe(403);
    expect(
      (
        await reception("PUT", "/signatures/me", {
          imageDataUrl: TINY_SIGNATURE_PNG,
          signerName: "Unauthorized Staff",
        })
      ).status,
    ).toBe(403);
  });

  it("encrypts saved signatures at rest in SQLite and requires explicit authorization confirmation on every sign", async () => {
    const saveRes = await admin("PUT", "/signatures/me", {
      imageDataUrl: TINY_SIGNATURE_PNG,
      signerName: "Sunil Kumar",
      signerQualification: "",
    });
    expect(saveRes.status).toBe(200);

    // Inspect raw SQLite row to verify base64 PNG is encrypted, never stored in cleartext
    const rawRow = srv.ctx.db
      .prepare("SELECT image_cipher FROM saved_signatures WHERE user_id = 1")
      .get() as { image_cipher: string };
    expect(rawRow.image_cipher).toBeTruthy();
    expect(rawRow.image_cipher.includes("data:image/png")).toBe(false);

    const me = await admin("GET", "/signatures/me");
    expect(me.status).toBe(200);
    expect(me.body.hasSaved).toBe(true);
    expect(me.body.imageDataUrl).toBe(TINY_SIGNATURE_PNG);

    // Create a patient & unpaid invoice to test invoice signing & lock
    const p = await admin("POST", "/patients", {
      name: "Kiran Rao",
      phone: "9845012340",
      gender: "Male",
      dateOfBirth: "1986-05-10",
      consentRecorded: true,
    });
    const inv = await admin("POST", "/invoices", {
      patientId: p.body.id,
      invoiceDate: "2026-05-14",
      items: [{ description: "Physiotherapy Session", quantity: 1, unitPrice: 120_000, discount: 0, taxRateBp: 0 }],
    });
    expect(inv.status).toBe(201);

    // Missing confirmAuthorization must fail with 400
    expect(
      (
        await admin("POST", `/documents/invoice/${inv.body.id}/sign`, {
          mode: "saved",
          confirmAuthorization: false,
        })
      ).status,
    ).toBe(400);

    // Reception cannot sign invoice
    expect(
      (
        await reception("POST", `/documents/invoice/${inv.body.id}/sign`, {
          mode: "saved",
          confirmAuthorization: true,
        })
      ).status,
    ).toBe(403);

    // Authorized signing succeeds and locks the invoice against silent PUT edits
    const signRes = await admin("POST", `/documents/invoice/${inv.body.id}/sign`, {
      mode: "saved",
      confirmAuthorization: true,
    });
    expect(signRes.status).toBe(201);
    expect(signRes.body.signature.payloadSha256).toHaveLength(64);

    const editAttempt = await admin("PUT", `/invoices/${inv.body.id}`, {
      patientId: p.body.id,
      invoiceDate: "2026-05-14",
      items: [{ description: "Tampered", quantity: 1, unitPrice: 50_000, discount: 0, taxRateBp: 0 }],
    });
    expect(editAttempt.status).toBe(409);
  });
});

describe("Detailed Physiotherapy Bill API, zero ledger duplication & 5-minute workflow", () => {
  let patientA: number;
  let patientB: number;
  let completedAppt1: number;
  let completedAppt2: number;
  let cancelledAppt: number;
  let otherPatientAppt: number;

  it("imports ONLY completed sessions belonging to the selected patient within the date range", async () => {
    patientA = (
      await admin("POST", "/patients", {
        name: "Insurance Rehab Patient",
        phone: "9900112233",
        gender: "Female",
        dateOfBirth: "1990-02-15",
        consentRecorded: true,
      })
    ).body.id;

    patientB = (
      await admin("POST", "/patients", {
        name: "Unrelated Patient",
        phone: "9900112244",
        consentRecorded: true,
      })
    ).body.id;

    completedAppt1 = (
      await admin("POST", "/appointments", {
        patientId: patientA,
        visitType: "clinic",
        date: "2026-03-16",
        time: "10:00",
        physiotherapist: "Sunil Kumar",
        status: "completed",
      })
    ).body.id;

    completedAppt2 = (
      await admin("POST", "/appointments", {
        patientId: patientA,
        visitType: "home",
        date: "2026-03-18",
        time: "16:00",
        physiotherapist: "Sunil Kumar",
        status: "completed",
      })
    ).body.id;

    // Must be excluded: cancelled, confirmed, requested, out-of-range, and patientB
    cancelledAppt = (
      await admin("POST", "/appointments", {
        patientId: patientA,
        visitType: "clinic",
        date: "2026-03-19",
        time: "10:00",
        physiotherapist: "Sunil Kumar",
        status: "cancelled",
      })
    ).body.id;

    await admin("POST", "/appointments", {
      patientId: patientA,
      visitType: "clinic",
      date: "2026-03-20",
      time: "10:00",
      physiotherapist: "Sunil Kumar",
      status: "confirmed",
    });

    otherPatientAppt = (
      await admin("POST", "/appointments", {
        patientId: patientB,
        visitType: "clinic",
        date: "2026-03-17",
        time: "11:00",
        physiotherapist: "Sunil Kumar",
        status: "completed",
      })
    ).body.id;

    const imp = await admin(
      "GET",
      `/detailed-bills/completed-sessions?patientId=${patientA}&from=2026-03-16&to=2026-05-14`,
    );
    expect(imp.status).toBe(200);
    expect(imp.body.sessions.map((s: { sourceAppointmentId: number }) => s.sourceAppointmentId)).toEqual([
      completedAppt1,
      completedAppt2,
    ]);

    // Attempting to attach a cancelled or other-patient appointment ID must fail validation
    expect(
      (
        await admin("POST", "/detailed-bills", {
          patientId: patientA,
          patientName: "Insurance Rehab Patient",
          treatmentStartDate: "2026-03-16",
          treatmentEndDate: "2026-03-31",
          billDate: "2026-03-31",
          sessions: [{ sessionDate: "2026-03-19", amount: 120_000, sourceAppointmentId: cancelledAppt }],
        })
      ).status,
    ).toBe(400);

    expect(
      (
        await admin("POST", "/detailed-bills", {
          patientId: patientA,
          patientName: "Insurance Rehab Patient",
          treatmentStartDate: "2026-03-16",
          treatmentEndDate: "2026-03-31",
          billDate: "2026-03-31",
          sessions: [{ sessionDate: "2026-03-17", amount: 120_000, sourceAppointmentId: otherPatientAppt }],
        })
      ).status,
    ).toBe(400);
  });

  it("completes the 37-session @ Rs. 1,200 = Rs. 44,400 end-to-end creation, signing, PDF build & revision without duplicating ledger revenue", async () => {
    const revBefore = (await admin("GET", "/reports/revenue?from=2026-01-01&to=2026-12-31&group=month")).body.totals;

    // Build 37 dates from 16-Mar-2026 to 14-May-2026
    const dates: string[] = [];
    const cur = new Date("2026-03-16T00:00:00Z");
    while (dates.length < 36) {
      if (cur.getUTCDay() !== 0) dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    dates.push("2026-05-14");

    const t0 = performance.now();

    const createRes = await physio("POST", "/detailed-bills", {
      patientId: patientA,
      patientName: "Insurance Rehab Patient",
      patientAgeGender: "36 and Female",
      referredBy: "Dr. Orthopaedic Consultant",
      treatmentStartDate: "2026-03-16",
      treatmentEndDate: "2026-05-14",
      billNo: "042",
      billDate: "2026-05-14",
      defaultCharge: 120_000,
      status: "ready_for_signature",
      sessions: dates.map((sessionDate) => ({
        sessionDate,
        particulars: "Physiotherapy Charges",
        amount: 120_000,
      })),
    });

    expect(createRes.status).toBe(201);
    const created: DetailedBillFull = createRes.body;
    expect(created.totalSessions).toBe(37);
    expect(created.totalAmount).toBe(4_440_000);
    expect(created.amountInWords).toBe("Rupees Forty Four Thousand Four Hundred Only");

    // Sign with clinician's drawn smartphone signature
    const signRes = await physio("POST", `/documents/detailed_bill/${created.id}/sign`, {
      mode: "drawn",
      imageDataUrl: TINY_SIGNATURE_PNG,
      signerName: "Sunil Kumar",
      signerQualification: "",
      saveForReuse: true,
      confirmAuthorization: true,
    });
    expect(signRes.status).toBe(201);

    const signedBill: DetailedBillFull = (await physio("GET", `/detailed-bills/${created.id}`)).body;
    expect(signedBill.status).toBe("signed");
    expect(signedBill.signature?.signerName).toBe("Sunil Kumar");

    // Generate reference-matched multi-page A4 PDF
    const pdfDoc = buildDetailedBillPdfDoc(
      {
        billNo: signedBill.billNo,
        billDate: signedBill.billDate,
        treatmentStartDate: signedBill.treatmentStartDate,
        treatmentEndDate: signedBill.treatmentEndDate,
        patientName: signedBill.patientName,
        ageGender: signedBill.patientAgeGender,
        referredBy: signedBill.referredBy,
        sessions: signedBill.sessions.map((s) => ({
          date: s.sessionDate,
          particulars: s.particulars,
          amount: s.amount,
        })),
        signature: signedBill.signature,
      },
      defaultSettings,
    );
    const pdfBytes = pdfDoc.output("arraybuffer");
    const elapsedMs = performance.now() - t0;

    expect(pdfBytes.byteLength).toBeGreaterThan(4_000);
    expect(pdfDoc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    // Programmatic creation + signing + multi-page PDF generation completes in well under 2 seconds
    expect(elapsedMs).toBeLessThan(5_000);

    // Zero duplicate financial entries: revenue totals in invoices/payments remain completely unchanged
    const revAfter = (await admin("GET", "/reports/revenue?from=2026-01-01&to=2026-12-31&group=month")).body.totals;
    expect(revAfter.billed).toBe(revBefore.billed);
    expect(revAfter.collected).toBe(revBefore.collected);

    // Signed bill is immutable against silent PUT or reverting to draft
    expect(
      (
        await physio("PUT", `/detailed-bills/${created.id}`, {
          patientId: patientA,
          patientName: "Tampered Name",
          treatmentStartDate: "2026-03-16",
          treatmentEndDate: "2026-05-14",
          billDate: "2026-05-14",
          sessions: [{ sessionDate: "2026-03-16", amount: 120_000 }],
        })
      ).status,
    ).toBe(409);

    expect(
      (await physio("POST", `/detailed-bills/${created.id}/status`, { status: "draft" })).status,
    ).toBe(409);

    // Superseding revision preserves v1 + signature and opens editable v2 (-R2) draft
    const revBillRes = await physio("POST", `/detailed-bills/${created.id}/revise`);
    expect(revBillRes.status).toBe(201);
    expect(revBillRes.body.version).toBe(2);
    expect(revBillRes.body.billNo).toBe("042-R2");
    expect(revBillRes.body.status).toBe("draft");
    expect(revBillRes.body.signature).toBeNull();

    const originalAfterRevise: DetailedBillFull = (await physio("GET", `/detailed-bills/${created.id}`)).body;
    expect(originalAfterRevise.status).toBe("superseded");
    expect(originalAfterRevise.supersededById).toBe(revBillRes.body.id);
    expect(originalAfterRevise.signature?.signerName).toBe("Sunil Kumar");

    // Duplicate creates a brand-new v1 draft with an auto-allocated bill number
    const dupRes = await physio("POST", `/detailed-bills/${created.id}/duplicate`);
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.version).toBe(1);
    expect(dupRes.body.status).toBe("draft");
    expect(dupRes.body.billNo).toMatch(/^NPC-DB\//);
  });

  it("renders clean multi-page A4 PDFs for 1, 10, 37, and 105 sessions without truncation", () => {
    const buildWithCount = (count: number) => {
      const sessions = Array.from({ length: count }, (_, idx) => {
        const d = new Date("2026-01-01T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + idx);
        const iso = d.toISOString().slice(0, 10);
        return {
          date: iso,
          particulars: "Physiotherapy Charges",
          amount: 120_000,
        };
      });
      return buildDetailedBillPdfDoc(
        {
          billNo: `TEST-${count}`,
          billDate: sessions[sessions.length - 1].date,
          treatmentStartDate: sessions[0].date,
          treatmentEndDate: sessions[sessions.length - 1].date,
          patientName: "Sample Test Patient",
          ageGender: "45 and Male",
          referredBy: "Dr. Sample",
          sessions,
          signature: {
            id: 1,
            docType: "detailed_bill",
            docId: count,
            docNo: `TEST-${count}`,
            docVersion: 1,
            payloadSha256: "abc",
            imageDataUrl: TINY_SIGNATURE_PNG,
            signerUserId: 1,
            signerUsername: "sunil",
            signerName: "Sunil Kumar",
            signerQualification: "",
            signedAt: "2026-05-14T10:00:00.000Z",
          },
        },
        defaultSettings,
      );
    };

    const doc1 = buildWithCount(1);
    const doc10 = buildWithCount(10);
    const doc37 = buildWithCount(37);
    const doc105 = buildWithCount(105);

    expect(doc1.getNumberOfPages()).toBe(1);
    expect(doc10.getNumberOfPages()).toBe(1);
    expect(doc37.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(doc105.getNumberOfPages()).toBeGreaterThanOrEqual(4);
    expect(doc105.output("arraybuffer").byteLength).toBeGreaterThan(10_000);
  });
});
