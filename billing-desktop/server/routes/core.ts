import { Router, type Request } from "express";
import { z } from "zod";
import { BillingError, calcInvoice, financialYear, formatDocNumber, paymentStatus } from "../../shared/billing";
import { can } from "../../shared/types";
import { audit, requirePerm } from "../auth";
import type { Ctx } from "../context";
import { nowIso, today, type DB } from "../db";
import { getKV, getSettings, setKV } from "../settings";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const optStr = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const id = (req: Request) => {
  const n = Number(req.params.id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid id");
  return n;
};

/** Allocates the next sequence number atomically (call inside a transaction). */
export function nextSeq(db: DB, key: string) {
  const n = Number(getKV(db, key) ?? "0") + 1;
  setKV(db, key, String(n));
  return n;
}

function nextDocNumber(db: DB, kind: "invoice" | "receipt", date: string) {
  const s = getSettings(db);
  const fy = s.invoice.resetEachFinancialYear ? financialYear(date) : null;
  const prefix = kind === "invoice" ? s.invoice.prefix : s.invoice.receiptPrefix;
  const key = `seq:${kind}:${fy ?? "all"}`;
  for (;;) {
    const no = formatDocNumber(prefix, fy, nextSeq(db, key), s.invoice.padding);
    const table = kind === "invoice" ? "invoices" : "payments";
    const col = kind === "invoice" ? "invoice_no" : "receipt_no";
    // Guard against collisions if the prefix/counter was changed manually.
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ?`).get(no)) return no;
  }
}

export function coreRoutes(ctx: Ctx) {
  const r = Router();

  // ======================= PATIENTS =======================
  const patientSchema = z.object({
    name: z.string().trim().min(2, "Enter the patient's name").max(120),
    phone: optStr(20).refine((v) => !v || /^[+\d][\d\s-]{6,18}$/.test(v), "Enter a valid phone number"),
    email: optStr(120).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
    gender: optStr(20),
    dateOfBirth: z.union([dateStr, z.literal(""), z.null()]).optional().transform((v) => v || null),
    address: optStr(400),
    emergencyContact: optStr(200),
    adminNotes: optStr(1000),
    consentRecorded: z.boolean().optional(),
  });

  const patientRow = (p: Record<string, unknown>) => ({
    id: p.id, patientCode: p.patient_code, name: p.name, phone: p.phone, email: p.email, gender: p.gender, dateOfBirth: p.date_of_birth,
    address: p.address, emergencyContact: p.emergency_contact, adminNotes: p.admin_notes, consentRecordedAt: p.consent_recorded_at,
    anonymisedAt: p.anonymised_at, createdAt: p.created_at, updatedAt: p.updated_at,
  });

  r.get("/patients", requirePerm("patients.read"), (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const where = q ? "WHERE p.name LIKE @like OR p.phone LIKE @like OR p.patient_code LIKE @like OR p.email LIKE @like" : "";
    const rows = ctx.db
      .prepare(
        `SELECT p.*, COALESCE(SUM(CASE WHEN i.status != 'void' THEN i.total - i.paid END), 0) AS outstanding,
                MAX(i.invoice_date) AS last_invoice
         FROM patients p LEFT JOIN invoices i ON i.patient_id = p.id ${where}
         GROUP BY p.id ORDER BY p.updated_at DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ like, limit, offset }) as Record<string, unknown>[];
    const total = (ctx.db.prepare(`SELECT COUNT(*) c FROM patients p ${where}`).get(q ? { like } : {}) as { c: number }).c;
    res.json({ total, items: rows.map((p) => ({ ...patientRow(p), outstanding: p.outstanding, lastInvoice: p.last_invoice })) });
  });

  r.get("/patients/:id", requirePerm("patients.read"), (req, res) => {
    const p = ctx.db.prepare("SELECT * FROM patients WHERE id = ?").get(id(req)) as Record<string, unknown> | undefined;
    if (!p) throw new HttpError(404, "Patient not found");
    const invoices = ctx.db.prepare("SELECT id, invoice_no, invoice_date, total, paid, status FROM invoices WHERE patient_id = ? ORDER BY invoice_date DESC, id DESC").all(p.id);
    const payments = ctx.db
      .prepare("SELECT pay.id, pay.receipt_no, pay.amount, pay.method, pay.paid_on, i.invoice_no FROM payments pay JOIN invoices i ON i.id = pay.invoice_id WHERE i.patient_id = ? ORDER BY pay.paid_on DESC, pay.id DESC")
      .all(p.id);
    const appointments = ctx.db.prepare("SELECT * FROM appointments WHERE patient_id = ? ORDER BY date DESC, time DESC").all(p.id);
    const totals = ctx.db
      .prepare("SELECT COALESCE(SUM(total),0) billed, COALESCE(SUM(paid),0) paid FROM invoices WHERE patient_id = ? AND status != 'void'")
      .get(p.id) as { billed: number; paid: number };
    res.json({ patient: patientRow(p), invoices, payments, appointments, totals: { ...totals, outstanding: totals.billed - totals.paid } });
  });

  r.post("/patients", requirePerm("patients.write"), (req, res) => {
    const d = patientSchema.parse(req.body);
    const created = ctx.db.transaction(() => {
      const code = `NPC-P-${String(nextSeq(ctx.db, "seq:patient")).padStart(5, "0")}`;
      const info = ctx.db
        .prepare(
          `INSERT INTO patients (patient_code, name, phone, email, gender, date_of_birth, address, emergency_contact, admin_notes, consent_recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(code, d.name, d.phone, d.email, d.gender, d.dateOfBirth, d.address, d.emergencyContact, d.adminNotes, d.consentRecorded ? nowIso() : null);
      return { id: Number(info.lastInsertRowid), code };
    })();
    audit(ctx.db, req.user!, "patient.create", "patient", created.id, { code: created.code });
    res.status(201).json(created);
  });

  r.put("/patients/:id", requirePerm("patients.write"), (req, res) => {
    const pid = id(req);
    const d = patientSchema.parse(req.body);
    const cur = ctx.db.prepare("SELECT consent_recorded_at, anonymised_at FROM patients WHERE id = ?").get(pid) as { consent_recorded_at: string | null; anonymised_at: string | null } | undefined;
    if (!cur) throw new HttpError(404, "Patient not found");
    if (cur.anonymised_at) throw new HttpError(409, "This patient record has been anonymised and cannot be edited");
    ctx.db
      .prepare(
        `UPDATE patients SET name=?, phone=?, email=?, gender=?, date_of_birth=?, address=?, emergency_contact=?, admin_notes=?,
         consent_recorded_at=?, updated_at=? WHERE id=?`,
      )
      .run(d.name, d.phone, d.email, d.gender, d.dateOfBirth, d.address, d.emergencyContact, d.adminNotes,
        d.consentRecorded ? cur.consent_recorded_at ?? nowIso() : null, nowIso(), pid);
    audit(ctx.db, req.user!, "patient.update", "patient", pid);
    res.json({ ok: true });
  });

  /** Data-subject access: export everything held about one patient. */
  r.get("/patients/:id/export", requirePerm("patients.delete"), (req, res) => {
    const pid = id(req);
    const patient = ctx.db.prepare("SELECT * FROM patients WHERE id = ?").get(pid);
    if (!patient) throw new HttpError(404, "Patient not found");
    const data = {
      exportedAt: nowIso(),
      patient,
      appointments: ctx.db.prepare("SELECT * FROM appointments WHERE patient_id = ?").all(pid),
      invoices: ctx.db.prepare("SELECT * FROM invoices WHERE patient_id = ?").all(pid),
      invoiceItems: ctx.db.prepare("SELECT ii.* FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.patient_id = ?").all(pid),
      payments: ctx.db.prepare("SELECT p.* FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.patient_id = ?").all(pid),
      clinicalNotes: ctx.db.prepare("SELECT * FROM clinical_notes WHERE patient_id = ?").all(pid),
    };
    audit(ctx.db, req.user!, "patient.export", "patient", pid);
    res.setHeader("Content-Disposition", `attachment; filename="patient-${pid}-export.json"`);
    res.json(data);
  });

  /**
   * Deletion workflow. Patients with no invoices are deleted outright.
   * Patients with financial records are anonymised: identifying details and
   * clinical notes are erased, while invoices are kept for statutory accounts.
   */
  r.delete("/patients/:id", requirePerm("patients.delete"), (req, res) => {
    const pid = id(req);
    const reason = z.object({ reason: z.string().trim().min(5, "Record the reason for deletion") }).parse(req.body).reason;
    const p = ctx.db.prepare("SELECT patient_code FROM patients WHERE id = ?").get(pid) as { patient_code: string } | undefined;
    if (!p) throw new HttpError(404, "Patient not found");
    const hasInvoices = !!ctx.db.prepare("SELECT 1 FROM invoices WHERE patient_id = ? LIMIT 1").get(pid);
    ctx.db.transaction(() => {
      if (hasInvoices) {
        ctx.db.prepare("DELETE FROM clinical_notes WHERE patient_id = ?").run(pid);
        ctx.db.prepare("UPDATE appointments SET notes = NULL WHERE patient_id = ?").run(pid);
        ctx.db
          .prepare(
            `UPDATE patients SET name = ?, phone = NULL, email = NULL, gender = NULL, date_of_birth = NULL, address = NULL,
             emergency_contact = NULL, admin_notes = NULL, anonymised_at = ?, updated_at = ? WHERE id = ?`,
          )
          .run(`Anonymised patient ${p.patient_code}`, nowIso(), nowIso(), pid);
      } else {
        ctx.db.prepare("DELETE FROM patients WHERE id = ?").run(pid);
      }
    })();
    audit(ctx.db, req.user!, hasInvoices ? "patient.anonymise" : "patient.delete", "patient", pid, { code: p.patient_code, reason });
    res.json({ ok: true, mode: hasInvoices ? "anonymised" : "deleted" });
  });

  // ---- clinical notes (restricted) ----
  r.get("/patients/:id/notes", requirePerm("clinical.read"), (req, res) => {
    const pid = id(req);
    const notes = ctx.db
      .prepare("SELECT n.id, n.note, n.created_at, u.display_name AS author FROM clinical_notes n LEFT JOIN users u ON u.id = n.author_id WHERE patient_id = ? ORDER BY n.created_at DESC")
      .all(pid);
    audit(ctx.db, req.user!, "clinical.view", "patient", pid);
    res.json(notes);
  });
  r.post("/patients/:id/notes", requirePerm("clinical.write"), (req, res) => {
    const pid = id(req);
    const { note } = z.object({ note: z.string().trim().min(1).max(5000) }).parse(req.body);
    const info = ctx.db.prepare("INSERT INTO clinical_notes (patient_id, author_id, note) VALUES (?, ?, ?)").run(pid, req.user!.id, note);
    audit(ctx.db, req.user!, "clinical.create", "patient", pid);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  // ======================= SERVICES CATALOGUE =======================
  r.get("/services", requirePerm("invoices.read"), (_req, res) => {
    res.json(ctx.db.prepare("SELECT * FROM services ORDER BY active DESC, name").all());
  });
  const serviceSchema = z.object({ name: z.string().trim().min(2).max(120), defaultPrice: z.number().int().min(0), taxable: z.boolean(), active: z.boolean() });
  r.post("/services", requirePerm("settings.write"), (req, res) => {
    const d = serviceSchema.parse(req.body);
    const info = ctx.db.prepare("INSERT INTO services (name, default_price, taxable, active) VALUES (?, ?, ?, ?)").run(d.name, d.defaultPrice, d.taxable ? 1 : 0, d.active ? 1 : 0);
    audit(ctx.db, req.user!, "service.create", "service", Number(info.lastInsertRowid), d);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });
  r.put("/services/:id", requirePerm("settings.write"), (req, res) => {
    const d = serviceSchema.parse(req.body);
    ctx.db.prepare("UPDATE services SET name=?, default_price=?, taxable=?, active=? WHERE id=?").run(d.name, d.defaultPrice, d.taxable ? 1 : 0, d.active ? 1 : 0, id(req));
    audit(ctx.db, req.user!, "service.update", "service", id(req), d);
    res.json({ ok: true });
  });

  // ======================= INVOICES =======================
  const itemSchema = z.object({
    serviceId: z.number().int().positive().nullable().optional(),
    description: z.string().trim().min(1, "Describe the service").max(200),
    quantity: z.number().int().min(1).max(1000),
    unitPrice: z.number().int().min(0),
    discount: z.number().int().min(0),
    taxRateBp: z.number().int().min(0).max(5000),
  });
  const invoiceSchema = z.object({
    patientId: z.number().int().positive(),
    invoiceDate: dateStr,
    items: z.array(itemSchema).min(1, "Add at least one service").max(50),
    notes: optStr(1000),
    payment: z
      .object({ amount: z.number().int().positive(), method: z.string().min(1).max(40), reference: optStr(80), paidOn: dateStr })
      .optional()
      .nullable(),
  });

  function computeItems(items: z.infer<typeof itemSchema>[]) {
    const taxOn = getSettings(ctx.db).tax.enabled;
    // When tax is disabled globally, force all tax rates to 0.
    return calcInvoice(items.map((i) => ({ ...i, serviceId: i.serviceId ?? null, taxRateBp: taxOn ? i.taxRateBp : 0 })));
  }

  function writeItems(invoiceId: number, lines: ReturnType<typeof computeItems>["lines"]) {
    ctx.db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(invoiceId);
    const ins = ctx.db.prepare(
      "INSERT INTO invoice_items (invoice_id, position, service_id, description, quantity, unit_price, discount, tax_rate_bp, tax, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    lines.forEach((l, i) => ins.run(invoiceId, i, l.serviceId ?? null, l.description, l.quantity, l.unitPrice, l.discount, l.taxRateBp, l.tax, l.total));
  }

  function refreshInvoiceTotals(invoiceId: number) {
    const inv = ctx.db.prepare("SELECT total, status FROM invoices WHERE id = ?").get(invoiceId) as { total: number; status: string };
    const paid = (ctx.db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE invoice_id = ?").get(invoiceId) as { s: number }).s;
    ctx.db.prepare("UPDATE invoices SET paid = ?, status = ?, updated_at = ? WHERE id = ?").run(paid, paymentStatus(inv.total, paid, inv.status === "void"), nowIso(), invoiceId);
  }

  function addPayment(invoiceId: number, p: { amount: number; method: string; reference: string | null; paidOn: string }, userId: number) {
    const inv = ctx.db.prepare("SELECT total, paid, status FROM invoices WHERE id = ?").get(invoiceId) as { total: number; paid: number; status: string } | undefined;
    if (!inv) throw new HttpError(404, "Invoice not found");
    if (inv.status === "void") throw new HttpError(409, "Cannot record a payment on a void invoice");
    if (!getSettings(ctx.db).paymentMethods.includes(p.method)) throw new HttpError(400, "Choose a configured payment method");
    if (p.amount > inv.total - inv.paid) throw new HttpError(400, "Payment is more than the outstanding balance");
    const receiptNo = nextDocNumber(ctx.db, "receipt", p.paidOn);
    const info = ctx.db
      .prepare("INSERT INTO payments (receipt_no, invoice_id, amount, method, reference, paid_on, received_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(receiptNo, invoiceId, p.amount, p.method, p.reference, p.paidOn, userId);
    refreshInvoiceTotals(invoiceId);
    return { id: Number(info.lastInsertRowid), receiptNo };
  }

  r.get("/invoices", requirePerm("invoices.read"), (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "");
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    const conds: string[] = [];
    const params: Record<string, unknown> = { limit: Math.min(Number(req.query.limit) || 50, 500), offset: Math.max(Number(req.query.offset) || 0, 0) };
    if (q) {
      conds.push("(i.invoice_no LIKE @q OR p.name LIKE @q OR p.patient_code LIKE @q OR p.phone LIKE @q)");
      params.q = `%${q.replace(/[%_]/g, "")}%`;
    }
    if (["unpaid", "partial", "paid", "void"].includes(status)) {
      conds.push("i.status = @status");
      params.status = status;
    } else if (status === "outstanding") conds.push("i.status IN ('unpaid','partial')");
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      conds.push("i.invoice_date >= @from");
      params.from = from;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      conds.push("i.invoice_date <= @to");
      params.to = to;
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const items = ctx.db
      .prepare(
        `SELECT i.id, i.invoice_no, i.invoice_date, i.total, i.paid, i.status, p.name AS patient_name, p.patient_code, p.id AS patient_id
         FROM invoices i JOIN patients p ON p.id = i.patient_id ${where} ORDER BY i.invoice_date DESC, i.id DESC LIMIT @limit OFFSET @offset`,
      )
      .all(params);
    const { limit: _l, offset: _o, ...countParams } = params;
    void _l;
    void _o;
    const total = (ctx.db.prepare(`SELECT COUNT(*) c FROM invoices i JOIN patients p ON p.id = i.patient_id ${where}`).get(countParams) as { c: number }).c;
    res.json({ total, items });
  });

  r.get("/invoices/:id", requirePerm("invoices.read"), (req, res) => {
    const inv = ctx.db
      .prepare(
        `SELECT i.*, p.name AS patient_name, p.patient_code, p.phone AS patient_phone, p.address AS patient_address, p.email AS patient_email,
                u.display_name AS created_by_name
         FROM invoices i JOIN patients p ON p.id = i.patient_id LEFT JOIN users u ON u.id = i.created_by WHERE i.id = ?`,
      )
      .get(id(req));
    if (!inv) throw new HttpError(404, "Invoice not found");
    const items = ctx.db.prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position").all(id(req));
    const payments = ctx.db
      .prepare("SELECT pay.*, u.display_name AS received_by_name FROM payments pay LEFT JOIN users u ON u.id = pay.received_by WHERE invoice_id = ? ORDER BY paid_on, pay.id")
      .all(id(req));
    res.json({ invoice: inv, items, payments });
  });

  r.post("/invoices", requirePerm("invoices.write"), (req, res) => {
    const d = invoiceSchema.parse(req.body);
    if (d.payment && !can(req.user!.role, "payments.write")) throw new HttpError(403, "You don't have permission to record payments");
    const patient = ctx.db.prepare("SELECT anonymised_at FROM patients WHERE id = ?").get(d.patientId) as { anonymised_at: string | null } | undefined;
    if (!patient) throw new HttpError(400, "Choose a patient");
    if (patient.anonymised_at) throw new HttpError(409, "Cannot bill an anonymised patient record");
    const t = computeItems(d.items);
    const out = ctx.db.transaction(() => {
      const invoiceNo = nextDocNumber(ctx.db, "invoice", d.invoiceDate);
      const info = ctx.db
        .prepare(
          `INSERT INTO invoices (invoice_no, patient_id, invoice_date, subtotal, discount_total, tax_total, total, paid, status, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        )
        .run(invoiceNo, d.patientId, d.invoiceDate, t.subtotal, t.discountTotal, t.taxTotal, t.total, paymentStatus(t.total, 0), d.notes, req.user!.id);
      const invoiceId = Number(info.lastInsertRowid);
      writeItems(invoiceId, t.lines);
      let receipt: { id: number; receiptNo: string } | null = null;
      if (d.payment) receipt = addPayment(invoiceId, { ...d.payment, reference: d.payment.reference ?? null }, req.user!.id);
      ctx.db.prepare("UPDATE patients SET updated_at = ? WHERE id = ?").run(nowIso(), d.patientId);
      return { id: invoiceId, invoiceNo, receipt };
    })();
    audit(ctx.db, req.user!, "invoice.create", "invoice", out.id, { invoiceNo: out.invoiceNo, total: t.total });
    res.status(201).json(out);
  });

  /** Editing is allowed only before any payment is recorded; afterwards void and re-issue. */
  r.put("/invoices/:id", requirePerm("invoices.write"), (req, res) => {
    const iid = id(req);
    const d = invoiceSchema.omit({ payment: true }).parse(req.body);
    const cur = ctx.db.prepare("SELECT status, paid, invoice_no FROM invoices WHERE id = ?").get(iid) as { status: string; paid: number; invoice_no: string } | undefined;
    if (!cur) throw new HttpError(404, "Invoice not found");
    if (cur.status === "void") throw new HttpError(409, "Void invoices cannot be edited");
    if (cur.paid > 0) throw new HttpError(409, "This invoice has payments. Void it and create a new one instead.");
    const t = computeItems(d.items);
    ctx.db.transaction(() => {
      ctx.db
        .prepare("UPDATE invoices SET patient_id=?, invoice_date=?, subtotal=?, discount_total=?, tax_total=?, total=?, status=?, notes=?, updated_at=? WHERE id=?")
        .run(d.patientId, d.invoiceDate, t.subtotal, t.discountTotal, t.taxTotal, t.total, paymentStatus(t.total, 0), d.notes, nowIso(), iid);
      writeItems(iid, t.lines);
    })();
    audit(ctx.db, req.user!, "invoice.update", "invoice", iid, { invoiceNo: cur.invoice_no, total: t.total });
    res.json({ ok: true });
  });

  r.post("/invoices/:id/void", requirePerm("invoices.void"), (req, res) => {
    const iid = id(req);
    const { reason } = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(300) }).parse(req.body);
    const cur = ctx.db.prepare("SELECT status, invoice_no FROM invoices WHERE id = ?").get(iid) as { status: string; invoice_no: string } | undefined;
    if (!cur) throw new HttpError(404, "Invoice not found");
    if (cur.status === "void") throw new HttpError(409, "Invoice is already void");
    ctx.db.prepare("UPDATE invoices SET status='void', void_reason=?, updated_at=? WHERE id=?").run(reason, nowIso(), iid);
    audit(ctx.db, req.user!, "invoice.void", "invoice", iid, { invoiceNo: cur.invoice_no, reason });
    res.json({ ok: true });
  });

  r.post("/invoices/:id/payments", requirePerm("payments.write"), (req, res) => {
    const iid = id(req);
    const p = z.object({ amount: z.number().int().positive("Enter an amount"), method: z.string().min(1).max(40), reference: optStr(80), paidOn: dateStr }).parse(req.body);
    const out = ctx.db.transaction(() => addPayment(iid, p, req.user!.id))();
    audit(ctx.db, req.user!, "payment.create", "invoice", iid, { receiptNo: out.receiptNo, amount: p.amount, method: p.method });
    res.status(201).json(out);
  });

  /** Removing a payment (admin only) — e.g. a mistaken entry. Logged in the audit trail. */
  r.delete("/payments/:id", requirePerm("invoices.void"), (req, res) => {
    const pid = id(req);
    const { reason } = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters)") }).parse(req.body);
    const pay = ctx.db.prepare("SELECT invoice_id, receipt_no, amount FROM payments WHERE id = ?").get(pid) as { invoice_id: number; receipt_no: string; amount: number } | undefined;
    if (!pay) throw new HttpError(404, "Payment not found");
    ctx.db.transaction(() => {
      ctx.db.prepare("DELETE FROM payments WHERE id = ?").run(pid);
      refreshInvoiceTotals(pay.invoice_id);
    })();
    audit(ctx.db, req.user!, "payment.delete", "payment", pid, { ...pay, reason });
    res.json({ ok: true });
  });

  r.get("/payments/:id", requirePerm("invoices.read"), (req, res) => {
    const pay = ctx.db
      .prepare(
        `SELECT pay.*, i.invoice_no, i.total AS invoice_total, i.paid AS invoice_paid, i.invoice_date, p.name AS patient_name, p.patient_code, p.phone AS patient_phone,
                u.display_name AS received_by_name
         FROM payments pay JOIN invoices i ON i.id = pay.invoice_id JOIN patients p ON p.id = i.patient_id LEFT JOIN users u ON u.id = pay.received_by WHERE pay.id = ?`,
      )
      .get(id(req));
    if (!pay) throw new HttpError(404, "Payment not found");
    res.json(pay);
  });

  // ======================= APPOINTMENTS =======================
  const apptSchema = z.object({
    patientId: z.number().int().positive(),
    visitType: z.enum(["clinic", "home"]),
    date: dateStr,
    time: z.string().regex(/^\d{2}:\d{2}$/, "Use a valid time"),
    physiotherapist: optStr(80),
    status: z.enum(["requested", "confirmed", "completed", "cancelled", "no_show"]),
    notes: optStr(1000),
  });

  r.get("/appointments", requirePerm("appointments.read"), (req, res) => {
    const from = String(req.query.from ?? today());
    const to = String(req.query.to ?? "9999-12-31");
    const status = String(req.query.status ?? "");
    const rows = ctx.db
      .prepare(
        `SELECT a.*, p.name AS patient_name, p.patient_code, p.phone AS patient_phone FROM appointments a JOIN patients p ON p.id = a.patient_id
         WHERE a.date BETWEEN ? AND ? ${status ? "AND a.status = ?" : ""} ORDER BY a.date, a.time LIMIT 500`,
      )
      .all(...(status ? [from, to, status] : [from, to]));
    res.json(rows);
  });

  r.post("/appointments", requirePerm("appointments.write"), (req, res) => {
    const d = apptSchema.parse(req.body);
    const clash = ctx.db
      .prepare("SELECT 1 FROM appointments WHERE date = ? AND time = ? AND status IN ('requested','confirmed') AND COALESCE(physiotherapist,'') = COALESCE(?, '')")
      .get(d.date, d.time, d.physiotherapist);
    if (clash && !req.query.force) throw new HttpError(409, "Another appointment is already booked at this time for the same physiotherapist");
    const info = ctx.db
      .prepare("INSERT INTO appointments (patient_id, visit_type, date, time, physiotherapist, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(d.patientId, d.visitType, d.date, d.time, d.physiotherapist, d.status, d.notes);
    audit(ctx.db, req.user!, "appointment.create", "appointment", Number(info.lastInsertRowid));
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  r.put("/appointments/:id", requirePerm("appointments.write"), (req, res) => {
    const d = apptSchema.parse(req.body);
    const aid = id(req);
    const info = ctx.db
      .prepare("UPDATE appointments SET patient_id=?, visit_type=?, date=?, time=?, physiotherapist=?, status=?, notes=?, updated_at=? WHERE id=?")
      .run(d.patientId, d.visitType, d.date, d.time, d.physiotherapist, d.status, d.notes, nowIso(), aid);
    if (!info.changes) throw new HttpError(404, "Appointment not found");
    audit(ctx.db, req.user!, "appointment.update", "appointment", aid, { status: d.status });
    res.json({ ok: true });
  });

  r.delete("/appointments/:id", requirePerm("appointments.write"), (req, res) => {
    const aid = id(req);
    ctx.db.prepare("DELETE FROM appointments WHERE id = ?").run(aid);
    audit(ctx.db, req.user!, "appointment.delete", "appointment", aid);
    res.json({ ok: true });
  });

  return r;
}

export { BillingError };
