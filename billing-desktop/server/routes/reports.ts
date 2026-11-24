import { Router } from "express";
import { can } from "../../shared/types";
import { requirePerm } from "../auth";
import type { Ctx } from "../context";
import { today } from "../db";

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function reportRoutes(ctx: Ctx) {
  const r = Router();

  r.get("/dashboard", (req, res) => {
    const db = ctx.db;
    const t = today();
    const monthStart = t.slice(0, 8) + "01";
    const financial = can(req.user!.role, "dashboard.financial");
    const one = <T>(sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as T;

    const base = {
      totalPatients: one<{ c: number }>("SELECT COUNT(*) c FROM patients WHERE anonymised_at IS NULL").c,
      upcomingAppointments: db
        .prepare(
          `SELECT a.id, a.date, a.time, a.visit_type, a.status, a.physiotherapist, p.name AS patient_name, p.id AS patient_id
           FROM appointments a JOIN patients p ON p.id = a.patient_id
           WHERE a.date >= ? AND a.status IN ('requested','confirmed') ORDER BY a.date, a.time LIMIT 8`,
        )
        .all(t),
      recentInvoices: db
        .prepare(
          `SELECT i.id, i.invoice_no, i.invoice_date, i.total, i.paid, i.status, p.name AS patient_name
           FROM invoices i JOIN patients p ON p.id = i.patient_id ORDER BY i.id DESC LIMIT 8`,
        )
        .all(),
      todayAppointments: one<{ c: number }>("SELECT COUNT(*) c FROM appointments WHERE date = ? AND status IN ('requested','confirmed','completed')", t).c,
    };
    if (!financial) return void res.json({ financial: false, ...base });

    const collected = (from: string, to: string) => one<{ s: number }>("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE paid_on BETWEEN ? AND ?", from, to).s;
    const billed = (from: string, to: string) => one<{ s: number }>("SELECT COALESCE(SUM(total),0) s FROM invoices WHERE status != 'void' AND invoice_date BETWEEN ? AND ?", from, to).s;

    // Last 12 months trend
    const [y, m] = t.split("-").map(Number);
    const months: { month: string; collected: number; billed: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const key = d.toISOString().slice(0, 7);
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      months.push({ month: key, collected: collected(`${key}-01`, end), billed: billed(`${key}-01`, end) });
    }

    res.json({
      financial: true,
      ...base,
      todayCollected: collected(t, t),
      todayBilled: billed(t, t),
      monthCollected: collected(monthStart, t),
      monthBilled: billed(monthStart, t),
      outstanding: one<{ s: number; c: number }>("SELECT COALESCE(SUM(total - paid),0) s, COUNT(*) c FROM invoices WHERE status IN ('unpaid','partial')"),
      recentPayments: db
        .prepare(
          `SELECT pay.id, pay.receipt_no, pay.amount, pay.method, pay.paid_on, p.name AS patient_name, i.id AS invoice_id
           FROM payments pay JOIN invoices i ON i.id = pay.invoice_id JOIN patients p ON p.id = i.patient_id ORDER BY pay.id DESC LIMIT 8`,
        )
        .all(),
      trend: months,
      methods: db.prepare("SELECT method, COALESCE(SUM(amount),0) total, COUNT(*) count FROM payments WHERE paid_on BETWEEN ? AND ? GROUP BY method ORDER BY total DESC").all(monthStart, t),
    });
  });

  // -------- reports (admin) --------
  r.use("/reports", requirePerm("reports.read"));

  function range(q: Record<string, unknown>) {
    const to = isDate(q.to) ? q.to : today();
    const from = isDate(q.from) ? q.from : addDays(to, -29);
    return { from, to };
  }

  r.get("/reports/revenue", (req, res) => {
    const { from, to } = range(req.query);
    const group = req.query.group === "month" ? "month" : req.query.group === "week" ? "week" : "day";
    const fmt = group === "month" ? "%Y-%m" : group === "week" ? "%Y-W%W" : "%Y-%m-%d";
    const collected = ctx.db
      .prepare(`SELECT strftime('${fmt}', paid_on) period, SUM(amount) collected, COUNT(*) payments FROM payments WHERE paid_on BETWEEN ? AND ? GROUP BY period`)
      .all(from, to) as { period: string; collected: number; payments: number }[];
    const billed = ctx.db
      .prepare(
        `SELECT strftime('${fmt}', invoice_date) period, SUM(total) billed, SUM(discount_total) discounts, SUM(tax_total) tax, COUNT(*) invoices
         FROM invoices WHERE status != 'void' AND invoice_date BETWEEN ? AND ? GROUP BY period`,
      )
      .all(from, to) as { period: string; billed: number; discounts: number; tax: number; invoices: number }[];
    const map = new Map<string, Record<string, number | string>>();
    for (const b of billed) map.set(b.period, { period: b.period, billed: b.billed, discounts: b.discounts, tax: b.tax, invoices: b.invoices, collected: 0, payments: 0 });
    for (const c of collected) {
      const row = map.get(c.period) ?? { period: c.period, billed: 0, discounts: 0, tax: 0, invoices: 0 };
      map.set(c.period, { ...row, collected: c.collected, payments: c.payments });
    }
    const rows = [...map.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const totals = rows.reduce<Record<string, number>>(
      (t, r) => {
        for (const k of ["billed", "collected", "discounts", "tax", "invoices", "payments"]) t[k] += Number(r[k] ?? 0);
        return t;
      },
      { billed: 0, collected: 0, discounts: 0, tax: 0, invoices: 0, payments: 0 },
    );
    res.json({ from, to, group, rows, totals });
  });

  r.get("/reports/outstanding", (_req, res) => {
    const t = today();
    const rows = ctx.db
      .prepare(
        `SELECT i.id, i.invoice_no, i.invoice_date, i.total, i.paid, i.total - i.paid AS balance, i.status,
                p.name AS patient_name, p.patient_code, p.phone AS patient_phone,
                CAST(julianday(?) - julianday(i.invoice_date) AS INTEGER) AS age_days
         FROM invoices i JOIN patients p ON p.id = i.patient_id WHERE i.status IN ('unpaid','partial') ORDER BY i.invoice_date`,
      )
      .all(t) as { balance: number; age_days: number }[];
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    for (const r of rows) {
      const k = r.age_days <= 30 ? "0-30" : r.age_days <= 60 ? "31-60" : r.age_days <= 90 ? "61-90" : "90+";
      buckets[k] += r.balance;
    }
    res.json({ rows, buckets, total: rows.reduce((s, r) => s + r.balance, 0) });
  });

  r.get("/reports/services", (req, res) => {
    const { from, to } = range(req.query);
    const rows = ctx.db
      .prepare(
        `SELECT COALESCE(s.name, ii.description) AS service, SUM(ii.quantity) quantity, SUM(ii.quantity * ii.unit_price) gross,
                SUM(ii.discount) discounts, SUM(ii.tax) tax, SUM(ii.total) total, COUNT(DISTINCT ii.invoice_id) invoices
         FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id LEFT JOIN services s ON s.id = ii.service_id
         WHERE i.status != 'void' AND i.invoice_date BETWEEN ? AND ? GROUP BY service ORDER BY total DESC`,
      )
      .all(from, to) as { total: number }[];
    res.json({ from, to, rows, total: rows.reduce((s, r) => s + r.total, 0) });
  });

  r.get("/reports/methods", (req, res) => {
    const { from, to } = range(req.query);
    const rows = ctx.db
      .prepare("SELECT method, SUM(amount) total, COUNT(*) count FROM payments WHERE paid_on BETWEEN ? AND ? GROUP BY method ORDER BY total DESC")
      .all(from, to) as { total: number }[];
    res.json({ from, to, rows, total: rows.reduce((s, r) => s + r.total, 0) });
  });

  r.get("/reports/payments", (req, res) => {
    const { from, to } = range(req.query);
    const rows = ctx.db
      .prepare(
        `SELECT pay.id, pay.receipt_no, pay.paid_on, pay.amount, pay.method, pay.reference,
                i.id AS invoice_id, i.invoice_no, p.id AS patient_id, p.name AS patient_name, p.patient_code
         FROM payments pay
         JOIN invoices i ON i.id = pay.invoice_id
         JOIN patients p ON p.id = i.patient_id
         WHERE pay.paid_on BETWEEN ? AND ?
         ORDER BY pay.paid_on DESC, pay.id DESC LIMIT 1000`,
      )
      .all(from, to) as { amount: number }[];
    res.json({ from, to, rows, count: rows.length, total: rows.reduce((s, r) => s + r.amount, 0) });
  });

  r.get("/reports/patients", (req, res) => {
    const { from, to } = range(req.query);
    const rows = ctx.db
      .prepare(
        `SELECT p.id, p.patient_code, p.name, COUNT(i.id) invoices, COALESCE(SUM(i.total),0) billed, COALESCE(SUM(i.paid),0) paid,
                COALESCE(SUM(i.total - i.paid),0) outstanding, MAX(i.invoice_date) last_invoice
         FROM patients p JOIN invoices i ON i.patient_id = p.id
         WHERE i.status != 'void' AND i.invoice_date BETWEEN ? AND ? GROUP BY p.id ORDER BY billed DESC`,
      )
      .all(from, to);
    res.json({ from, to, rows });
  });

  return r;
}
