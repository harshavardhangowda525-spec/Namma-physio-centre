import { describe, expect, it } from "vitest";
import { DemoApiError, demoApi, resetDemoState } from "../src/demo-backend";

describe("isolated demo backend", () => {
  it("seeds realistic fictional records with active today appointments and collections", async () => {
    resetDemoState();
    const status = await demoApi<{ needsSetup: boolean; user: { role: string } | null }>("GET", "/auth/status");
    expect(status.needsSetup).toBe(false);
    expect(status.user?.role).toBe("admin");

    const dash = await demoApi<{
      financial: boolean;
      totalPatients: number;
      todayAppointments: number;
      todayCollected: number;
      outstanding: { s: number; c: number };
      trend: unknown[];
    }>("GET", "/dashboard");
    expect(dash.financial).toBe(true);
    expect(dash.totalPatients).toBe(10);
    expect(dash.todayAppointments).toBeGreaterThanOrEqual(4);
    expect(dash.todayCollected).toBeGreaterThan(0);
    expect(dash.outstanding.c).toBeGreaterThan(0);
    expect(dash.trend).toHaveLength(12);
  });

  it("supports creating patients, invoices, payments, role switching and resetting", async () => {
    const created = await demoApi<{ id: number; code: string }>("POST", "/patients", {
      name: "Test Demo Patient",
      phone: "+91 98450 99999",
      consentRecorded: true,
    });
    expect(created.code).toBe("NPC-P-00011");

    const inv = await demoApi<{ id: number; invoiceNo: string; receipt: { id: number; receiptNo: string } }>("POST", "/invoices", {
      patientId: created.id,
      invoiceDate: "2026-11-24",
      items: [{ description: "Post-Surgical Rehab Session", quantity: 2, unitPrice: 85000, discount: 10000, taxRateBp: 0 }],
      payment: { amount: 100000, method: "UPI", reference: "DEMO-UTR-1", paidOn: "2026-11-24" },
    });
    expect(inv.invoiceNo).toMatch(/^NPC\//);
    expect(inv.receipt.receiptNo).toMatch(/^RCPT\//);

    const detail = await demoApi<{ invoice: { total: number; paid: number; status: string } }>("GET", `/invoices/${inv.id}`);
    expect(detail.invoice.total).toBe(160000);
    expect(detail.invoice.paid).toBe(100000);
    expect(detail.invoice.status).toBe("partial");

    // Reception role cannot access clinical notes or financial reports
    await demoApi("POST", "/demo/switch-role", { role: "reception" });
    await expect(demoApi("GET", "/patients/1/notes")).rejects.toBeInstanceOf(DemoApiError);
    await expect(demoApi("GET", "/reports/revenue")).rejects.toBeInstanceOf(DemoApiError);

    // Reset restores clean fictional dataset
    await demoApi("POST", "/demo/reset");
    const afterReset = await demoApi<{ total: number }>("GET", "/patients");
    expect(afterReset.total).toBe(10);
  });

  it("supports Detailed Physiotherapy Bills, handwritten signatures, RBAC and revisions in demo mode", async () => {
    resetDemoState();
    const list = await demoApi<{ total: number; items: { id: number; status: string }[] }>("GET", "/detailed-bills");
    expect(list.total).toBe(1);

    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const billId = list.items[0].id;

    // Explicit confirmation is required
    await expect(
      demoApi("POST", `/documents/detailed_bill/${billId}/sign`, {
        mode: "drawn",
        imageDataUrl: png,
        signerName: "Sunil Kumar",
        confirmAuthorization: false,
      }),
    ).rejects.toBeInstanceOf(DemoApiError);

    // Authorized signing locks the bill
    const signed = await demoApi<{ signature: { signerName: string; docVersion: number } }>(
      "POST",
      `/documents/detailed_bill/${billId}/sign`,
      {
        mode: "drawn",
        imageDataUrl: png,
        signerName: "Sunil Kumar",
        saveForReuse: true,
        confirmAuthorization: true,
      },
    );
    expect(signed.signature.signerName).toBe("Sunil Kumar");

    // Signed bill cannot be edited directly
    await expect(
      demoApi("PUT", `/detailed-bills/${billId}`, {
        patientId: 1,
        patientName: "Raghavendra Rao",
        treatmentStartDate: "2026-01-01",
        treatmentEndDate: "2026-12-31",
        billDate: "2026-06-01",
        sessions: [{ sessionDate: "2026-06-01", amount: 120_000 }],
      }),
    ).rejects.toBeInstanceOf(DemoApiError);

    // Revision creates v2 draft and supersedes v1
    const rev = await demoApi<{ id: number; version: number; status: string }>("POST", `/detailed-bills/${billId}/revise`);
    expect(rev.version).toBe(2);
    expect(rev.status).toBe("draft");

    // Reception cannot manage or apply clinician signatures
    await demoApi("POST", "/demo/switch-role", { role: "reception" });
    await expect(demoApi("GET", "/signatures/me")).rejects.toBeInstanceOf(DemoApiError);
  });
});
