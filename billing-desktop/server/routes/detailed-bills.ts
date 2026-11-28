import { createHash } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { calcDetailedBill, financialYear, formatDocNumber } from "../../shared/billing";
import type {
  DetailedBillFull,
  DetailedBillStatus,
  DetailedBillSummary,
  DocumentSignatureRecord,
  SignableDocumentType,
} from "../../shared/types";
import { audit, requirePerm } from "../auth";
import type { Ctx } from "../context";
import { nowIso, today, type DB } from "../db";
import { getSettings } from "../settings";
import { HttpError, nextSeq } from "./core";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid YYYY-MM-DD date");
const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const PNG_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/;

function validateSignaturePng(dataUrl: string) {
  const clean = dataUrl.trim();
  if (!PNG_DATA_URL_RE.test(clean)) {
    throw new HttpError(400, "Signature must be a valid PNG image data URL");
  }
  if (clean.length > 450_000) {
    throw new HttpError(400, "Signature image is too large (must be under 450 KB)");
  }
  return clean;
}

function sha256(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function parseId(req: Request, param = "id"): number {
  const n = Number(req.params[param]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid identifier");
  return n;
}

export function allocateNextDetailedBillNo(db: DB, date: string, previewOnly = false): string {
  const s = getSettings(db);
  const fy = s.invoice.resetEachFinancialYear ? financialYear(date) : null;
  const prefix = s.invoice.detailedBillPrefix || "NPC-DB";
  const key = `seq:detailed_bill:${fy ?? "all"}`;

  if (previewOnly) {
    let seq = Number((db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? "0") + 1;
    for (;;) {
      const candidate = formatDocNumber(prefix, fy, seq, s.invoice.padding);
      if (!db.prepare("SELECT 1 FROM detailed_bills WHERE bill_no = ?").get(candidate)) return candidate;
      seq++;
    }
  }

  for (;;) {
    const candidate = formatDocNumber(prefix, fy, nextSeq(db, key), s.invoice.padding);
    if (!db.prepare("SELECT 1 FROM detailed_bills WHERE bill_no = ?").get(candidate)) return candidate;
  }
}

function mapSignatureRow(ctx: Ctx, r: Record<string, unknown>): DocumentSignatureRecord {
  let imageDataUrl = "";
  try {
    imageDataUrl = ctx.secretStore.decrypt(String(r.image_cipher));
  } catch {
    imageDataUrl = "";
  }
  return {
    id: Number(r.id),
    docType: r.doc_type as SignableDocumentType,
    docId: Number(r.doc_id),
    docNo: String(r.doc_no),
    docVersion: Number(r.doc_version),
    payloadSha256: String(r.payload_sha256),
    imageDataUrl,
    signerUserId: Number(r.signer_user_id),
    signerUsername: String(r.signer_username),
    signerName: String(r.signer_name),
    signerQualification: String(r.signer_qualification ?? ""),
    signedAt: String(r.signed_at),
  };
}

export function getLatestDocumentSignature(
  ctx: Ctx,
  docType: SignableDocumentType,
  docId: number,
): DocumentSignatureRecord | null {
  const row = ctx.db
    .prepare("SELECT * FROM document_signatures WHERE doc_type = ? AND doc_id = ? ORDER BY doc_version DESC, id DESC LIMIT 1")
    .get(docType, docId) as Record<string, unknown> | undefined;
  return row ? mapSignatureRow(ctx, row) : null;
}

function mapBillSummary(r: Record<string, unknown>): DetailedBillSummary {
  return {
    id: Number(r.id),
    billNo: String(r.bill_no),
    version: Number(r.version),
    parentBillId: r.parent_bill_id != null ? Number(r.parent_bill_id) : null,
    supersededById: r.superseded_by_id != null ? Number(r.superseded_by_id) : null,
    patientId: Number(r.patient_id),
    patientCode: String(r.patient_code ?? ""),
    patientPhone: r.patient_phone ? String(r.patient_phone) : null,
    patientName: String(r.patient_name),
    patientAgeGender: String(r.patient_age_gender ?? ""),
    referredBy: String(r.referred_by ?? ""),
    treatmentStartDate: String(r.treatment_start_date),
    treatmentEndDate: String(r.treatment_end_date),
    billDate: String(r.bill_date),
    defaultCharge: Number(r.default_charge),
    totalSessions: Number(r.total_sessions),
    totalAmount: Number(r.total_amount),
    amountInWords: String(r.amount_in_words),
    status: r.status as DetailedBillStatus,
    signedAt: r.signed_at ? String(r.signed_at) : null,
    sharedAt: r.shared_at ? String(r.shared_at) : null,
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function loadDetailedBillFull(ctx: Ctx, billId: number): DetailedBillFull | null {
  const row = ctx.db
    .prepare(
      `SELECT b.*, p.patient_code, p.phone AS patient_phone
       FROM detailed_bills b JOIN patients p ON p.id = b.patient_id
       WHERE b.id = ?`,
    )
    .get(billId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const sessions = (
    ctx.db
      .prepare("SELECT * FROM detailed_bill_sessions WHERE detailed_bill_id = ? ORDER BY sl_no ASC")
      .all(billId) as Record<string, unknown>[]
  ).map((s) => ({
    id: Number(s.id),
    slNo: Number(s.sl_no),
    sessionDate: String(s.session_date),
    dayName: String(s.day_name),
    particulars: String(s.particulars),
    amount: Number(s.amount),
    sourceAppointmentId: s.source_appointment_id != null ? Number(s.source_appointment_id) : null,
  }));

  const sig = getLatestDocumentSignature(ctx, "detailed_bill", billId);

  return {
    ...mapBillSummary(row),
    sessions,
    signature: sig,
  };
}

export function detailedBillAndSignatureRoutes(ctx: Ctx) {
  const r = Router();

  /* ======================= ELECTRONIC SIGNATURES ======================= */

  r.get("/signatures/me", requirePerm("signatures.manage"), (req, res) => {
    const s = getSettings(ctx.db);
    const row = ctx.db
      .prepare("SELECT * FROM saved_signatures WHERE user_id = ?")
      .get(req.user!.id) as Record<string, unknown> | undefined;
    if (!row) {
      res.json({
        hasSaved: false,
        signerName: s.clinic.signerName || req.user!.displayName,
        signerQualification: s.clinic.signerQualification || "",
        imageDataUrl: null,
        updatedAt: null,
      });
      return;
    }
    let imageDataUrl: string | null = null;
    try {
      imageDataUrl = ctx.secretStore.decrypt(String(row.image_cipher));
    } catch {
      imageDataUrl = null;
    }
    audit(ctx.db, req.user!, "signature.view_saved", "signature", Number(row.id));
    res.json({
      hasSaved: Boolean(imageDataUrl),
      signerName: String(row.signer_name),
      signerQualification: String(row.signer_qualification ?? ""),
      imageDataUrl,
      updatedAt: String(row.updated_at),
    });
  });

  const saveSigSchema = z.object({
    imageDataUrl: z.string().min(40),
    signerName: z.string().trim().min(2, "Enter signer name").max(120),
    signerQualification: z.string().trim().max(160).optional().default(""),
  });

  r.put("/signatures/me", requirePerm("signatures.manage"), (req, res) => {
    const d = saveSigSchema.parse(req.body);
    const cleanPng = validateSignaturePng(d.imageDataUrl);
    const cipher = ctx.secretStore.encrypt(cleanPng);
    const now = nowIso();
    ctx.db
      .prepare(
        `INSERT INTO saved_signatures (user_id, signer_name, signer_qualification, image_cipher, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           signer_name = excluded.signer_name,
           signer_qualification = excluded.signer_qualification,
           image_cipher = excluded.image_cipher,
           updated_at = excluded.updated_at`,
      )
      .run(req.user!.id, d.signerName, d.signerQualification, cipher, now, now);
    audit(ctx.db, req.user!, "signature.save", "signature", req.user!.id, { signerName: d.signerName });
    res.json({ ok: true, updatedAt: now });
  });

  r.delete("/signatures/me", requirePerm("signatures.manage"), (req, res) => {
    ctx.db.prepare("DELETE FROM saved_signatures WHERE user_id = ?").run(req.user!.id);
    audit(ctx.db, req.user!, "signature.delete", "signature", req.user!.id);
    res.json({ ok: true });
  });

  const docTypeSchema = z.enum(["invoice", "receipt", "detailed_bill", "session_statement"]);

  r.get("/documents/:docType/:docId/signature", requirePerm("invoices.read"), (req, res) => {
    const docType = docTypeSchema.parse(req.params.docType);
    const docId = parseId(req, "docId");
    res.json({ signature: getLatestDocumentSignature(ctx, docType, docId) });
  });

  const applySigSchema = z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("drawn"),
      imageDataUrl: z.string().min(40),
      signerName: z.string().trim().min(2, "Enter signer name").max(120),
      signerQualification: z.string().trim().max(160).optional().default(""),
      saveForReuse: z.boolean().optional().default(false),
      confirmAuthorization: z.literal(true, {
        errorMap: () => ({ message: "Explicit authorization confirmation is required before signing" }),
      }),
    }),
    z.object({
      mode: z.literal("saved"),
      signerName: z.string().trim().max(120).optional(),
      signerQualification: z.string().trim().max(160).optional(),
      confirmAuthorization: z.literal(true, {
        errorMap: () => ({ message: "Explicit authorization confirmation is required before applying a saved signature" }),
      }),
    }),
  ]);

  r.post("/documents/:docType/:docId/sign", requirePerm("signatures.manage"), (req, res) => {
    const docType = docTypeSchema.parse(req.params.docType);
    const docId = parseId(req, "docId");
    const d = applySigSchema.parse(req.body);

    // Resolve signature image & signer metadata
    let imageCipher: string;
    let signerName: string;
    let signerQual: string;

    if (d.mode === "drawn") {
      const cleanPng = validateSignaturePng(d.imageDataUrl);
      imageCipher = ctx.secretStore.encrypt(cleanPng);
      signerName = d.signerName;
      signerQual = d.signerQualification;

      if (d.saveForReuse) {
        const now = nowIso();
        ctx.db
          .prepare(
            `INSERT INTO saved_signatures (user_id, signer_name, signer_qualification, image_cipher, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
               signer_name = excluded.signer_name,
               signer_qualification = excluded.signer_qualification,
               image_cipher = excluded.image_cipher,
               updated_at = excluded.updated_at`,
          )
          .run(req.user!.id, signerName, signerQual, imageCipher, now, now);
      }
    } else {
      const saved = ctx.db
        .prepare("SELECT * FROM saved_signatures WHERE user_id = ?")
        .get(req.user!.id) as Record<string, unknown> | undefined;
      if (!saved) {
        throw new HttpError(400, "No saved signature found for your account. Please draw your signature first.");
      }
      imageCipher = String(saved.image_cipher);
      signerName = d.signerName?.trim() || String(saved.signer_name);
      signerQual = d.signerQualification?.trim() ?? String(saved.signer_qualification ?? "");
    }

    // Resolve canonical document snapshot & version so signed documents are tamper-locked
    let docNo = "";
    let docVersion = 1;
    let payloadDigest = "";

    if (docType === "detailed_bill") {
      const full = loadDetailedBillFull(ctx, docId);
      if (!full) throw new HttpError(404, "Detailed physiotherapy bill not found");
      if (full.status === "cancelled" || full.status === "superseded") {
        throw new HttpError(409, `Cannot sign a ${full.status} bill`);
      }
      docNo = full.billNo;
      docVersion = full.version;
      payloadDigest = sha256({
        billNo: full.billNo,
        version: full.version,
        patientId: full.patientId,
        patientName: full.patientName,
        totalSessions: full.totalSessions,
        totalAmount: full.totalAmount,
        sessions: full.sessions,
      });
    } else if (docType === "invoice") {
      const inv = ctx.db.prepare("SELECT * FROM invoices WHERE id = ?").get(docId) as Record<string, unknown> | undefined;
      if (!inv) throw new HttpError(404, "Invoice not found");
      if (inv.status === "void") throw new HttpError(409, "Cannot sign a void invoice");
      const items = ctx.db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position").all(docId);
      docNo = String(inv.invoice_no);
      payloadDigest = sha256({ invoice: inv, items });
    } else if (docType === "receipt") {
      const pay = ctx.db.prepare("SELECT * FROM payments WHERE id = ?").get(docId) as Record<string, unknown> | undefined;
      if (!pay) throw new HttpError(404, "Receipt not found");
      docNo = String(pay.receipt_no);
      payloadDigest = sha256(pay);
    } else {
      const pat = ctx.db.prepare("SELECT id, patient_code, name FROM patients WHERE id = ?").get(docId) as Record<string, unknown> | undefined;
      if (!pat) throw new HttpError(404, "Patient record not found");
      docNo = `STMT-${pat.patient_code}`;
      const existingCount = (
        ctx.db
          .prepare("SELECT COUNT(*) c FROM document_signatures WHERE doc_type = 'session_statement' AND doc_id = ?")
          .get(docId) as { c: number }
      ).c;
      docVersion = existingCount + 1;
      payloadDigest = sha256({ patient: pat, signedAt: today() });
    }

    const alreadySigned = ctx.db
      .prepare("SELECT 1 FROM document_signatures WHERE doc_type = ? AND doc_id = ? AND doc_version = ?")
      .get(docType, docId, docVersion);
    if (alreadySigned) {
      throw new HttpError(409, "This document version is already signed and locked against modification.");
    }

    const signedAt = nowIso();
    const record = ctx.db.transaction(() => {
      const info = ctx.db
        .prepare(
          `INSERT INTO document_signatures
            (doc_type, doc_id, doc_no, doc_version, payload_sha256, image_cipher, signer_user_id, signer_username, signer_name, signer_qualification, signed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          docType,
          docId,
          docNo,
          docVersion,
          payloadDigest,
          imageCipher,
          req.user!.id,
          req.user!.username,
          signerName,
          signerQual,
          signedAt,
        );

      if (docType === "detailed_bill") {
        ctx.db
          .prepare("UPDATE detailed_bills SET status = 'signed', signed_at = ?, updated_at = ? WHERE id = ?")
          .run(signedAt, signedAt, docId);
      }

      return Number(info.lastInsertRowid);
    })();

    audit(ctx.db, req.user!, "document.sign", docType, docId, {
      docNo,
      docVersion,
      signerName,
      mode: d.mode,
      payloadSha256: payloadDigest,
    });

    res.status(201).json({
      signature: mapSignatureRow(
        ctx,
        ctx.db.prepare("SELECT * FROM document_signatures WHERE id = ?").get(record) as Record<string, unknown>,
      ),
    });
  });

  /* ======================= DETAILED PHYSIOTHERAPY BILLS ======================= */

  r.get("/detailed-bills/next-number", requirePerm("detailed_bills.read"), (req, res) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date ?? "")) ? String(req.query.date) : today();
    res.json({ billNo: allocateNextDetailedBillNo(ctx.db, date, true) });
  });

  /**
   * Imports ONLY completed treatment sessions belonging to the selected patient
   * within [from, to]. Excludes requested, confirmed, cancelled, no_show, or other patients.
   */
  r.get("/detailed-bills/completed-sessions", requirePerm("detailed_bills.read"), (req, res) => {
    const patientId = Number(req.query.patientId);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      throw new HttpError(400, "Select a valid patient");
    }
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from ?? "")) ? String(req.query.from) : "0000-01-01";
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to ?? "")) ? String(req.query.to) : "9999-12-31";
    if (to < from) throw new HttpError(400, "End date cannot be earlier than start date");

    const rows = ctx.db
      .prepare(
        `SELECT id, date, time, visit_type, physiotherapist, notes
         FROM appointments
         WHERE patient_id = ? AND status = 'completed' AND date BETWEEN ? AND ?
         ORDER BY date ASC, time ASC, id ASC`,
      )
      .all(patientId, from, to) as Record<string, unknown>[];

    const defaultCharge = getSettings(ctx.db).invoice.defaultSessionChargePaise ?? 120_000;
    res.json({
      sessions: rows.map((a) => ({
        sourceAppointmentId: Number(a.id),
        sessionDate: String(a.date),
        time: String(a.time),
        visitType: String(a.visit_type),
        particulars: "Physiotherapy Charges",
        amount: defaultCharge,
        notes: a.notes ? String(a.notes) : null,
      })),
    });
  });

  r.get("/detailed-bills", requirePerm("detailed_bills.read"), (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const patientId = Number(req.query.patientId) || 0;
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();

    const conds: string[] = [];
    const params: Record<string, unknown> = {
      limit: Math.min(Number(req.query.limit) || 100, 500),
      offset: Math.max(Number(req.query.offset) || 0, 0),
    };

    if (q) {
      conds.push("(b.bill_no LIKE @q OR b.patient_name LIKE @q OR p.patient_code LIKE @q OR p.phone LIKE @q)");
      params.q = `%${q.replace(/[%_]/g, "")}%`;
    }
    if (
      ["draft", "ready_for_signature", "signed", "finalized", "shared", "cancelled", "superseded"].includes(status)
    ) {
      conds.push("b.status = @status");
      params.status = status;
    }
    if (patientId > 0) {
      conds.push("b.patient_id = @patientId");
      params.patientId = patientId;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      conds.push("b.treatment_end_date >= @from");
      params.from = from;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      conds.push("b.treatment_start_date <= @to");
      params.to = to;
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const rows = ctx.db
      .prepare(
        `SELECT b.*, p.patient_code, p.phone AS patient_phone
         FROM detailed_bills b JOIN patients p ON p.id = b.patient_id
         ${where}
         ORDER BY b.updated_at DESC, b.id DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all(params) as Record<string, unknown>[];

    const { limit: _l, offset: _o, ...countParams } = params;
    void _l;
    void _o;
    const total = (
      ctx.db
        .prepare(`SELECT COUNT(*) c FROM detailed_bills b JOIN patients p ON p.id = b.patient_id ${where}`)
        .get(countParams) as { c: number }
    ).c;

    res.json({ total, items: rows.map(mapBillSummary) });
  });

  r.get("/detailed-bills/:id", requirePerm("detailed_bills.read"), (req, res) => {
    const full = loadDetailedBillFull(ctx, parseId(req));
    if (!full) throw new HttpError(404, "Detailed physiotherapy bill not found");
    res.json(full);
  });

  const sessionItemSchema = z.object({
    sessionDate: dateStr,
    particulars: z.string().trim().max(200).optional().default("Physiotherapy Charges"),
    amount: z.number().int().min(0).max(100_000_000),
    sourceAppointmentId: z.number().int().positive().nullable().optional(),
  });

  const billPayloadSchema = z.object({
    patientId: z.number().int().positive("Select a patient"),
    patientName: z.string().trim().min(2, "Enter patient name").max(120),
    patientAgeGender: z.string().trim().max(80).optional().default(""),
    referredBy: z.string().trim().max(160).optional().default(""),
    treatmentStartDate: dateStr,
    treatmentEndDate: dateStr,
    billNo: z.string().trim().max(40).optional(),
    billDate: dateStr,
    defaultCharge: z.number().int().min(0).max(100_000_000).default(120_000),
    status: z.enum(["draft", "ready_for_signature"]).optional().default("draft"),
    notes: optStr(1000),
    sessions: z.array(sessionItemSchema).min(1, "Add at least one treatment session").max(400),
  });

  function writeBillSessions(billId: number, sessions: ReturnType<typeof calcDetailedBill>["sessions"]) {
    ctx.db.prepare("DELETE FROM detailed_bill_sessions WHERE detailed_bill_id = ?").run(billId);
    const ins = ctx.db.prepare(
      `INSERT INTO detailed_bill_sessions
        (detailed_bill_id, sl_no, session_date, day_name, particulars, amount, source_appointment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of sessions) {
      ins.run(billId, s.slNo, s.sessionDate, s.dayName, s.particulars, s.amount, s.sourceAppointmentId);
    }
  }

  r.post("/detailed-bills", requirePerm("detailed_bills.write"), (req, res) => {
    const d = billPayloadSchema.parse(req.body);
    const patient = ctx.db
      .prepare("SELECT id, anonymised_at FROM patients WHERE id = ?")
      .get(d.patientId) as { id: number; anonymised_at: string | null } | undefined;
    if (!patient) throw new HttpError(400, "Patient not found");
    if (patient.anonymised_at) throw new HttpError(409, "Cannot generate a bill for an anonymised patient record");

    // Verify imported appointment IDs actually belong to this patient and are completed
    for (const s of d.sessions) {
      if (s.sourceAppointmentId != null) {
        const okAppt = ctx.db
          .prepare("SELECT 1 FROM appointments WHERE id = ? AND patient_id = ? AND status = 'completed'")
          .get(s.sourceAppointmentId, d.patientId);
        if (!okAppt) {
          throw new HttpError(400, "Imported session must belong to the selected patient and be marked completed");
        }
      }
    }

    const calc = calcDetailedBill(d.sessions, {
      treatmentStartDate: d.treatmentStartDate,
      treatmentEndDate: d.treatmentEndDate,
    });

    const created = ctx.db.transaction(() => {
      const billNo = d.billNo?.trim() || allocateNextDetailedBillNo(ctx.db, d.billDate, false);
      const dup = ctx.db.prepare("SELECT 1 FROM detailed_bills WHERE bill_no = ?").get(billNo);
      if (dup) throw new HttpError(409, `Bill number "${billNo}" already exists. Use a unique bill number.`);

      const now = nowIso();
      const info = ctx.db
        .prepare(
          `INSERT INTO detailed_bills
            (bill_no, version, patient_id, patient_name, patient_age_gender, referred_by,
             treatment_start_date, treatment_end_date, bill_date, default_charge,
             total_sessions, total_amount, amount_in_words, status, notes, created_by, created_at, updated_at)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          billNo,
          d.patientId,
          d.patientName,
          d.patientAgeGender,
          d.referredBy,
          d.treatmentStartDate,
          d.treatmentEndDate,
          d.billDate,
          d.defaultCharge,
          calc.totalSessions,
          calc.totalAmount,
          calc.amountInWords,
          d.status,
          d.notes,
          req.user!.id,
          now,
          now,
        );
      const billId = Number(info.lastInsertRowid);
      writeBillSessions(billId, calc.sessions);
      return { id: billId, billNo };
    })();

    audit(ctx.db, req.user!, "detailed_bill.create", "detailed_bill", created.id, {
      billNo: created.billNo,
      totalSessions: calc.totalSessions,
      totalAmount: calc.totalAmount,
    });

    res.status(201).json(loadDetailedBillFull(ctx, created.id));
  });

  r.put("/detailed-bills/:id", requirePerm("detailed_bills.write"), (req, res) => {
    const billId = parseId(req);
    const cur = ctx.db
      .prepare("SELECT id, bill_no, status FROM detailed_bills WHERE id = ?")
      .get(billId) as { id: number; bill_no: string; status: DetailedBillStatus } | undefined;
    if (!cur) throw new HttpError(404, "Detailed physiotherapy bill not found");

    // Signed, finalized, shared, cancelled, or superseded bills are immutable!
    if (!["draft", "ready_for_signature"].includes(cur.status)) {
      throw new HttpError(
        409,
        `This bill is ${cur.status.replace(/_/g, " ")} and locked against silent modification. Create a revision instead.`,
      );
    }

    const d = billPayloadSchema.parse(req.body);
    const calc = calcDetailedBill(d.sessions, {
      treatmentStartDate: d.treatmentStartDate,
      treatmentEndDate: d.treatmentEndDate,
    });

    const nextBillNo = d.billNo?.trim() || cur.bill_no;
    const collision = ctx.db
      .prepare("SELECT 1 FROM detailed_bills WHERE bill_no = ? AND id != ?")
      .get(nextBillNo, billId);
    if (collision) throw new HttpError(409, `Bill number "${nextBillNo}" is already used by another bill.`);

    ctx.db.transaction(() => {
      ctx.db
        .prepare(
          `UPDATE detailed_bills SET
            bill_no = ?, patient_id = ?, patient_name = ?, patient_age_gender = ?, referred_by = ?,
            treatment_start_date = ?, treatment_end_date = ?, bill_date = ?, default_charge = ?,
            total_sessions = ?, total_amount = ?, amount_in_words = ?, status = ?, notes = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          nextBillNo,
          d.patientId,
          d.patientName,
          d.patientAgeGender,
          d.referredBy,
          d.treatmentStartDate,
          d.treatmentEndDate,
          d.billDate,
          d.defaultCharge,
          calc.totalSessions,
          calc.totalAmount,
          calc.amountInWords,
          d.status,
          d.notes,
          nowIso(),
          billId,
        );
      writeBillSessions(billId, calc.sessions);
    })();

    audit(ctx.db, req.user!, "detailed_bill.update", "detailed_bill", billId, {
      billNo: nextBillNo,
      totalSessions: calc.totalSessions,
      totalAmount: calc.totalAmount,
    });

    res.json(loadDetailedBillFull(ctx, billId));
  });

  r.post("/detailed-bills/:id/status", requirePerm("detailed_bills.write"), (req, res) => {
    const billId = parseId(req);
    const { status } = z
      .object({ status: z.enum(["draft", "ready_for_signature", "finalized", "shared", "cancelled"]) })
      .parse(req.body);

    const cur = loadDetailedBillFull(ctx, billId);
    if (!cur) throw new HttpError(404, "Detailed physiotherapy bill not found");
    if (cur.status === "superseded") throw new HttpError(409, "Superseded bills cannot change status");

    // Prevent reverting a signed bill back to draft
    if (cur.signature && (status === "draft" || status === "ready_for_signature")) {
      throw new HttpError(409, "Signed bills cannot be reverted to draft. Create a revision if changes are required.");
    }

    const now = nowIso();
    const sharedAt = status === "shared" ? now : cur.sharedAt;
    ctx.db
      .prepare("UPDATE detailed_bills SET status = ?, shared_at = ?, updated_at = ? WHERE id = ?")
      .run(status, sharedAt, now, billId);

    audit(ctx.db, req.user!, `detailed_bill.${status}`, "detailed_bill", billId, { billNo: cur.billNo });
    res.json(loadDetailedBillFull(ctx, billId));
  });

  /** Clones an existing bill into a brand-new editable Draft with a fresh unique bill number. */
  r.post("/detailed-bills/:id/duplicate", requirePerm("detailed_bills.write"), (req, res) => {
    const src = loadDetailedBillFull(ctx, parseId(req));
    if (!src) throw new HttpError(404, "Detailed physiotherapy bill not found");

    const nowDate = today();
    const now = nowIso();
    const newId = ctx.db.transaction(() => {
      const newBillNo = allocateNextDetailedBillNo(ctx.db, nowDate, false);
      const info = ctx.db
        .prepare(
          `INSERT INTO detailed_bills
            (bill_no, version, patient_id, patient_name, patient_age_gender, referred_by,
             treatment_start_date, treatment_end_date, bill_date, default_charge,
             total_sessions, total_amount, amount_in_words, status, notes, created_by, created_at, updated_at)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        )
        .run(
          newBillNo,
          src.patientId,
          src.patientName,
          src.patientAgeGender,
          src.referredBy,
          src.treatmentStartDate,
          src.treatmentEndDate,
          nowDate,
          src.defaultCharge,
          src.totalSessions,
          src.totalAmount,
          src.amountInWords,
          src.notes,
          req.user!.id,
          now,
          now,
        );
      const id = Number(info.lastInsertRowid);
      writeBillSessions(
        id,
        src.sessions.map((s, idx) => ({ ...s, slNo: idx + 1 })),
      );
      return id;
    })();

    audit(ctx.db, req.user!, "detailed_bill.duplicate", "detailed_bill", newId, { fromBillNo: src.billNo });
    res.status(201).json(loadDetailedBillFull(ctx, newId));
  });

  /**
   * Superseding revision workflow for signed/finalized bills:
   * Preserves the original signed version intact (marked `superseded`) and creates
   * an editable `draft` v(N+1) linked via `parent_bill_id` / `superseded_by_id`.
   */
  r.post("/detailed-bills/:id/revise", requirePerm("detailed_bills.write"), (req, res) => {
    const src = loadDetailedBillFull(ctx, parseId(req));
    if (!src) throw new HttpError(404, "Detailed physiotherapy bill not found");
    if (src.status === "superseded") {
      throw new HttpError(409, "This bill has already been superseded by a newer revision.");
    }

    const baseNo = src.billNo.replace(/-R\d+$/, "");
    const nextVer = src.version + 1;
    let revBillNo = `${baseNo}-R${nextVer}`;
    let suffix = nextVer;
    while (ctx.db.prepare("SELECT 1 FROM detailed_bills WHERE bill_no = ?").get(revBillNo)) {
      suffix++;
      revBillNo = `${baseNo}-R${suffix}`;
    }

    const now = nowIso();
    const newId = ctx.db.transaction(() => {
      const info = ctx.db
        .prepare(
          `INSERT INTO detailed_bills
            (bill_no, version, parent_bill_id, patient_id, patient_name, patient_age_gender, referred_by,
             treatment_start_date, treatment_end_date, bill_date, default_charge,
             total_sessions, total_amount, amount_in_words, status, notes, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        )
        .run(
          revBillNo,
          nextVer,
          src.id,
          src.patientId,
          src.patientName,
          src.patientAgeGender,
          src.referredBy,
          src.treatmentStartDate,
          src.treatmentEndDate,
          today(),
          src.defaultCharge,
          src.totalSessions,
          src.totalAmount,
          src.amountInWords,
          src.notes,
          req.user!.id,
          now,
          now,
        );
      const id = Number(info.lastInsertRowid);
      writeBillSessions(
        id,
        src.sessions.map((s, idx) => ({ ...s, slNo: idx + 1 })),
      );
      ctx.db
        .prepare("UPDATE detailed_bills SET status = 'superseded', superseded_by_id = ?, updated_at = ? WHERE id = ?")
        .run(id, now, src.id);
      return id;
    })();

    audit(ctx.db, req.user!, "detailed_bill.revise", "detailed_bill", newId, {
      supersedesId: src.id,
      supersedesBillNo: src.billNo,
      newBillNo: revBillNo,
      version: nextVer,
    });

    res.status(201).json(loadDetailedBillFull(ctx, newId));
  });

  return r;
}
