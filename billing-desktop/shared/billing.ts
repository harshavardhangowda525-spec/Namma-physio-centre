/**
 * Billing arithmetic. ALL money values are integers in paise (₹1 = 100 paise)
 * to avoid floating-point errors. Tax rates are in basis points (1800 = 18%).
 */

export type LineInput = {
  description: string;
  serviceId?: number | null;
  quantity: number; // sessions / units, integer >= 1
  unitPrice: number; // paise
  discount: number; // paise, total for the line
  taxRateBp: number; // basis points; 0 when not taxable
};

export type LineResult = LineInput & { gross: number; taxable: number; tax: number; total: number };

export type InvoiceTotals = {
  lines: LineResult[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
};

export class BillingError extends Error {}

/** Round half away from zero to the nearest paisa. */
export const roundPaise = (v: number) => Math.sign(v) * Math.round(Math.abs(v));

export function calcLine(l: LineInput): LineResult {
  if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 1000) throw new BillingError("Quantity must be a whole number between 1 and 1000");
  if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) throw new BillingError("Unit price must be zero or more");
  if (!Number.isInteger(l.discount) || l.discount < 0) throw new BillingError("Discount must be zero or more");
  if (!Number.isInteger(l.taxRateBp) || l.taxRateBp < 0 || l.taxRateBp > 5000) throw new BillingError("Tax rate must be between 0% and 50%");
  const gross = l.quantity * l.unitPrice;
  if (l.discount > gross) throw new BillingError(`Discount on "${l.description}" is more than the line amount`);
  const taxable = gross - l.discount;
  const tax = roundPaise((taxable * l.taxRateBp) / 10000);
  return { ...l, gross, taxable, tax, total: taxable + tax };
}

export function calcInvoice(lines: LineInput[]): InvoiceTotals {
  if (lines.length === 0) throw new BillingError("Add at least one service to the invoice");
  const r = lines.map(calcLine);
  const subtotal = r.reduce((s, l) => s + l.gross, 0);
  const discountTotal = r.reduce((s, l) => s + l.discount, 0);
  const taxTotal = r.reduce((s, l) => s + l.tax, 0);
  return { lines: r, subtotal, discountTotal, taxTotal, total: subtotal - discountTotal + taxTotal };
}

export type PaymentStatus = "unpaid" | "partial" | "paid" | "void";

export function paymentStatus(total: number, paid: number, voided = false): PaymentStatus {
  if (voided) return "void";
  if (paid <= 0) return total === 0 ? "paid" : "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

/** Converts a percentage discount on a line to a paise amount. */
export function percentDiscount(gross: number, percent: number) {
  if (percent < 0 || percent > 100) throw new BillingError("Discount % must be between 0 and 100");
  return roundPaise((gross * percent) / 100);
}

/** Parses "1,234.50" / "1234.5" / "₹ 99" into paise. Returns null if invalid. */
export function rupeesToPaise(input: string | number): number | null {
  const s = String(input).replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [r, p = ""] = s.split(".");
  return Number(r) * 100 + Number((p + "00").slice(0, 2));
}

export function formatINR(paise: number, opts: { symbol?: boolean; decimals?: boolean } = {}) {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const grouped = rupees.toLocaleString("en-IN");
  const showDecimals = opts.decimals ?? true;
  const dec = showDecimals || rem > 0 ? `.${String(rem).padStart(2, "0")}` : "";
  return `${neg ? "-" : ""}${opts.symbol === false ? "" : "₹"}${grouped}${dec}`;
}

/** Formats integer rupees cleanly as in the reference document (e.g. 1200 or 44,400, with .50 only if paise > 0). */
export function formatRupeeNumber(paise: number, grouped = true): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const base = grouped ? rupees.toLocaleString("en-IN") : String(rupees);
  return `${neg ? "-" : ""}${base}${rem > 0 ? `.${String(rem).padStart(2, "0")}` : ""}`;
}

/** Indian financial year label (April–March), e.g. 2026-11-21 → "2026-27". */
export function financialYear(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function formatDocNumber(prefix: string, fy: string | null, seq: number, pad: number) {
  return [prefix, fy, String(seq).padStart(pad, "0")].filter(Boolean).join("/");
}

function indianWordsCore(paise: number): { rupeeWords: string; paiseWords: string | null } {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`);
  const three = (n: number) => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return [h ? `${ones[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
  };
  const words = (n: number): string => {
    if (n === 0) return "Zero";
    const parts: string[] = [];
    const crore = Math.floor(n / 1e7);
    const lakh = Math.floor((n % 1e7) / 1e5);
    const thousand = Math.floor((n % 1e5) / 1e3);
    const rest = n % 1e3;
    if (crore) parts.push(`${words(crore)} Crore`);
    if (lakh) parts.push(`${two(lakh)} Lakh`);
    if (thousand) parts.push(`${two(thousand)} Thousand`);
    if (rest) parts.push(three(rest));
    return parts.join(" ");
  };
  const r = Math.floor(Math.abs(paise) / 100);
  const p = Math.abs(paise) % 100;
  return { rupeeWords: words(r), paiseWords: p ? two(p) : null };
}

/** Amount in words (Indian numbering) for invoices, e.g. "One Thousand Two Hundred Rupees and Fifty Paise Only". */
export function amountInWords(paise: number): string {
  const { rupeeWords, paiseWords } = indianWordsCore(paise);
  return `${rupeeWords} Rupees${paiseWords ? ` and ${paiseWords} Paise` : ""} Only`;
}

/**
 * Exact Detailed Physiotherapy Bill wording matching the client's reference document:
 * e.g. 4440000 paise (₹44,400) -> "Rupees Forty Four Thousand Four Hundred Only".
 */
export function rupeesInWords(paise: number): string {
  const { rupeeWords, paiseWords } = indianWordsCore(paise);
  return `Rupees ${rupeeWords}${paiseWords ? ` and ${paiseWords} Paise` : ""} Only`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function dayOfWeekName(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return "-";
  const [y, m, d] = isoDate.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Formats YYYY-MM-DD as "16-Mar-26" or "1-Apr-26" matching the reference session table. */
export function formatRefSessionDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d}-${SHORT_MONTHS[m - 1]}-${String(y).slice(-2)}`;
}

/** Formats YYYY-MM-DD as "16-Mar-2026" matching the reference header table. */
export function formatRefHeaderDate(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${String(d).padStart(2, "0")}-${SHORT_MONTHS[m - 1]}-${y}`;
}

export type DetailedBillSessionInput = {
  sessionDate: string;
  particulars?: string;
  amount: number; // integer paise
  sourceAppointmentId?: number | null;
};

export type DetailedBillCalculated = {
  sessions: {
    slNo: number;
    sessionDate: string;
    dayName: string;
    particulars: string;
    amount: number;
    sourceAppointmentId: number | null;
  }[];
  totalSessions: number;
  totalAmount: number;
  amountInWords: string;
};

/** Validates and computes exact integer-paise totals and Indian amount-in-words for a Detailed Physiotherapy Bill. */
export function calcDetailedBill(
  rawSessions: DetailedBillSessionInput[],
  opts?: { treatmentStartDate?: string; treatmentEndDate?: string },
): DetailedBillCalculated {
  if (!rawSessions.length) throw new BillingError("Select at least one treatment session date");

  if (opts?.treatmentStartDate && opts?.treatmentEndDate) {
    if (!isValidIsoDate(opts.treatmentStartDate) || !isValidIsoDate(opts.treatmentEndDate)) {
      throw new BillingError("Enter valid treatment start and end dates");
    }
    if (opts.treatmentEndDate < opts.treatmentStartDate) {
      throw new BillingError("Treatment end date cannot be earlier than treatment start date");
    }
  }

  const sorted = [...rawSessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const seenAppointmentIds = new Set<number>();

  const sessions = sorted.map((s, idx) => {
    if (!isValidIsoDate(s.sessionDate)) {
      throw new BillingError(`Invalid session date: ${s.sessionDate}`);
    }
    if (opts?.treatmentStartDate && s.sessionDate < opts.treatmentStartDate) {
      throw new BillingError(`Session date ${s.sessionDate} is earlier than Treatment Start Date (${opts.treatmentStartDate})`);
    }
    if (opts?.treatmentEndDate && s.sessionDate > opts.treatmentEndDate) {
      throw new BillingError(`Session date ${s.sessionDate} is after Treatment End Date (${opts.treatmentEndDate})`);
    }
    if (!Number.isInteger(s.amount) || s.amount < 0 || s.amount > 100_000_000) {
      throw new BillingError("Session charge must be a valid non-negative rupee amount");
    }
    if (s.sourceAppointmentId != null) {
      if (seenAppointmentIds.has(s.sourceAppointmentId)) {
        throw new BillingError("Duplicate imported treatment session detected");
      }
      seenAppointmentIds.add(s.sourceAppointmentId);
    }
    return {
      slNo: idx + 1,
      sessionDate: s.sessionDate,
      dayName: dayOfWeekName(s.sessionDate),
      particulars: (s.particulars ?? "").trim() || "Physiotherapy Charges",
      amount: s.amount,
      sourceAppointmentId: s.sourceAppointmentId ?? null,
    };
  });

  const totalSessions = sessions.length;
  const totalAmount = sessions.reduce((sum, s) => sum + s.amount, 0);
  return {
    sessions,
    totalSessions,
    totalAmount,
    amountInWords: rupeesInWords(totalAmount),
  };
}
