import { describe, expect, it } from "vitest";
import { amountInWords, calcInvoice, calcLine, financialYear, formatDocNumber, formatINR, paymentStatus, percentDiscount, rupeesToPaise, BillingError } from "../shared/billing";

const line = (o: Partial<Parameters<typeof calcLine>[0]> = {}) => ({ description: "Session", quantity: 1, unitPrice: 80000, discount: 0, taxRateBp: 0, ...o });

describe("calcLine", () => {
  it("multiplies sessions by unit price", () => {
    expect(calcLine(line({ quantity: 6, unitPrice: 75000 })).total).toBe(450000);
  });
  it("applies discount before tax", () => {
    const r = calcLine(line({ quantity: 2, unitPrice: 100000, discount: 20000, taxRateBp: 1800 }));
    expect(r.gross).toBe(200000);
    expect(r.taxable).toBe(180000);
    expect(r.tax).toBe(32400);
    expect(r.total).toBe(212400);
  });
  it("rounds tax to the nearest paisa", () => {
    // 333.33 * 18% = 59.9994 -> 60.00
    expect(calcLine(line({ unitPrice: 33333, taxRateBp: 1800 })).tax).toBe(6000);
  });
  it("rejects a discount larger than the line", () => {
    expect(() => calcLine(line({ discount: 90000 }))).toThrow(BillingError);
  });
  it("rejects fractional or zero quantity and negative prices", () => {
    expect(() => calcLine(line({ quantity: 1.5 }))).toThrow();
    expect(() => calcLine(line({ quantity: 0 }))).toThrow();
    expect(() => calcLine(line({ unitPrice: -1 }))).toThrow();
  });
});

describe("calcInvoice", () => {
  it("sums mixed taxable and exempt lines", () => {
    const t = calcInvoice([line({ quantity: 5, unitPrice: 80000, discount: 40000 }), line({ description: "Brace", unitPrice: 120000, taxRateBp: 1200 })]);
    expect(t.subtotal).toBe(520000);
    expect(t.discountTotal).toBe(40000);
    expect(t.taxTotal).toBe(14400);
    expect(t.total).toBe(494400);
    expect(t.total).toBe(t.lines.reduce((s, l) => s + l.total, 0));
  });
  it("requires at least one line", () => {
    expect(() => calcInvoice([])).toThrow(BillingError);
  });
});

describe("helpers", () => {
  it("derives payment status", () => {
    expect(paymentStatus(1000, 0)).toBe("unpaid");
    expect(paymentStatus(1000, 400)).toBe("partial");
    expect(paymentStatus(1000, 1000)).toBe("paid");
    expect(paymentStatus(1000, 0, true)).toBe("void");
    expect(paymentStatus(0, 0)).toBe("paid");
  });
  it("parses rupees into paise exactly", () => {
    expect(rupeesToPaise("1,234.5")).toBe(123450);
    expect(rupeesToPaise("₹ 99")).toBe(9900);
    expect(rupeesToPaise("0.07")).toBe(7);
    expect(rupeesToPaise("12.345")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
  });
  it("formats INR with Indian grouping", () => {
    expect(formatINR(12345678)).toBe("₹1,23,456.78");
    expect(formatINR(5)).toBe("₹0.05");
  });
  it("computes percent discounts", () => {
    expect(percentDiscount(450000, 10)).toBe(45000);
    expect(() => percentDiscount(100, 120)).toThrow();
  });
  it("uses the Indian financial year", () => {
    expect(financialYear("2026-03-31")).toBe("2025-26");
    expect(financialYear("2026-04-01")).toBe("2026-27");
    expect(formatDocNumber("NPC", "2026-27", 7, 4)).toBe("NPC/2026-27/0007");
    expect(formatDocNumber("INV", null, 12, 5)).toBe("INV/00012");
  });
  it("writes amounts in words", () => {
    expect(amountInWords(123450)).toBe("One Thousand Two Hundred Thirty Four Rupees and Fifty Paise Only");
    expect(amountInWords(1250000000)).toBe("One Crore Twenty Five Lakh Rupees Only");
    expect(amountInWords(0)).toBe("Zero Rupees Only");
  });
});
