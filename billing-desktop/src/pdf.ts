import { jsPDF } from "jspdf";
import { amountInWords, formatINR } from "../shared/billing";
import type { Settings } from "../server/settings";

const NAVY: [number, number, number] = [11, 31, 58];
const TEAL: [number, number, number] = [22, 151, 141];
const TEAL_SOFT: [number, number, number] = [238, 250, 248];
const INK: [number, number, number] = [28, 37, 52];
const MUTED: [number, number, number] = [91, 102, 118];
const LINE: [number, number, number] = [226, 221, 210];
const ROSE: [number, number, number] = [190, 18, 60];
const AMBER: [number, number, number] = [180, 83, 9];

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

/** Formats paise for built-in PDF fonts (ASCII-safe Rs. prefix). */
function pdfMoney(paise: number | null | undefined, withPrefix = true): string {
  const p = paise ?? 0;
  const neg = p < 0;
  const raw = formatINR(Math.abs(p), { symbol: false });
  return `${neg ? "- " : ""}${withPrefix ? "Rs. " : ""}${raw}`;
}

/** Normalises Unicode punctuation that WinAnsi Helvetica does not encode. */
function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/₹/g, "Rs. ")
    .replace(/[−–—]/g, "-")
    .replace(/[·•]/g, " | ")
    .replace(/[^\x20-\x7E\n\r]/g, "");
}

function fmtPdfDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(+d) ? cleanText(iso) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function drawBrandHeader(doc: jsPDF, s: Settings, x: number, y: number): number {
  // Vector clinic emblem matching the UI Logo mark
  doc.setFillColor(...NAVY);
  doc.roundedRect(x, y, 13, 13, 3, 3, "F");
  doc.setDrawColor(63, 181, 170);
  doc.setLineWidth(1.1);
  doc.line(x + 3.6, y + 9.2, x + 6.5, y + 4.8);
  doc.line(x + 6.5, y + 4.8, x + 9.4, y + 9.2);
  doc.setFillColor(92, 200, 224);
  doc.circle(x + 6.5, y + 3.2, 0.9, "F");

  const tx = x + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(cleanText(s.clinic.name), tx, y + 5.5);

  let cy = y + 10;
  if (s.clinic.tagline) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEAL);
    doc.text(cleanText(s.clinic.tagline).toUpperCase(), tx, cy);
    cy += 4.5;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (s.clinic.address) {
    const addrLines = doc.splitTextToSize(cleanText(s.clinic.address), 98) as string[];
    doc.text(addrLines, tx, cy);
    cy += addrLines.length * 3.8;
  }

  const contactParts = [
    s.clinic.phone ? `Tel: ${cleanText(s.clinic.phone)}` : "",
    s.clinic.email ? cleanText(s.clinic.email) : "",
    s.clinic.gstin ? `GSTIN: ${cleanText(s.clinic.gstin)}` : "",
  ].filter(Boolean);
  if (contactParts.length) {
    doc.text(contactParts.join("  |  "), tx, cy + 0.5);
    cy += 4;
  }
  if (s.clinic.registrationNote) {
    doc.text(cleanText(s.clinic.registrationNote), tx, cy + 0.5);
    cy += 4;
  }
  return Math.max(y + 16, cy);
}

function drawStatusPill(doc: jsPDF, status: string, rightX: number, y: number) {
  const label = status === "partial" ? "PART-PAID" : status.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const w = doc.getTextWidth(label) + 7;
  const x = rightX - w;
  if (status === "paid") {
    doc.setFillColor(213, 242, 238);
    doc.setTextColor(15, 97, 92);
  } else if (status === "partial") {
    doc.setFillColor(254, 243, 199);
    doc.setTextColor(...AMBER);
  } else if (status === "void") {
    doc.setFillColor(226, 232, 240);
    doc.setTextColor(100, 116, 139);
  } else {
    doc.setFillColor(255, 228, 230);
    doc.setTextColor(...ROSE);
  }
  doc.roundedRect(x, y - 3.8, w, 5.6, 2.5, 2.5, "F");
  doc.text(label, x + 3.5, y);
}

function drawSignatureAndFooter(doc: jsPDF, s: Settings, startY: number) {
  const pageH = doc.internal.pageSize.getHeight();
  let y = Math.max(startY + 10, pageH - 54);
  if (y > pageH - 42) {
    doc.addPage();
    y = 30;
  }

  if (s.invoice.showStamp) {
    doc.setDrawColor(...LINE);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.circle(30, y + 10, 11, "S");
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("Clinic Stamp", 30, y + 10.8, { align: "center" });
  }

  if (s.invoice.showSignature) {
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(140, y + 15, 194, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text("Authorised Signatory", 167, y + 19.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`For ${cleanText(s.clinic.name)}`, 167, y + 23.5, { align: "center" });
  }

  const fy = pageH - 18;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(16, fy - 4, 194, fy - 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  if (s.invoice.footerNote) doc.text(cleanText(s.invoice.footerNote), 105, fy, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  const terms = [s.invoice.terms ? cleanText(s.invoice.terms) : "", IS_DEMO ? "Sample demonstration document (fictional patient data)" : ""]
    .filter(Boolean)
    .join("  |  ");
  if (terms) doc.text(terms, 105, fy + 4.2, { align: "center" });
}

export type PdfInvoiceData = {
  invoice: {
    invoice_no: string;
    invoice_date: string;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    total: number;
    paid: number;
    status: string;
    notes: string | null;
    void_reason: string | null;
    patient_name: string;
    patient_code: string;
    patient_phone: string | null;
    patient_address: string | null;
  };
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate_bp: number;
    tax: number;
    total: number;
  }[];
  payments: {
    receipt_no: string;
    amount: number;
    method: string;
    reference: string | null;
    paid_on: string;
  }[];
};

export function downloadInvoicePdf(data: PdfInvoiceData, s: Settings, fileName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { invoice: inv, items, payments } = data;
  const isVoid = inv.status === "void";
  const balance = isVoid ? 0 : Math.max(0, inv.total - inv.paid);
  const showTax = inv.tax_total > 0;

  // Header
  const headerBottom = drawBrandHeader(doc, s, 16, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text("INVOICE", 194, 19, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(cleanText(inv.invoice_no), 194, 25, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Date: ${fmtPdfDate(inv.invoice_date)}`, 194, 30, { align: "right" });
  drawStatusPill(doc, inv.status, 194, 36.5);

  let y = Math.max(headerBottom + 4, 44);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(16, y, 194, y);

  // Patient & Payment summary block
  y += 6;
  doc.setFillColor(251, 250, 247);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(16, y, 178, 26, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("PATIENT DETAILS (BILLED TO)", 20, y + 5.5);
  doc.text("PAYMENT SUMMARY", 122, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(cleanText(inv.patient_name), 20, y + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const pMeta = [`Patient ID: ${cleanText(inv.patient_code)}`, inv.patient_phone ? `Ph: ${cleanText(inv.patient_phone)}` : ""].filter(Boolean).join("  |  ");
  doc.text(pMeta, 20, y + 15.5);
  if (inv.patient_address) {
    const addr = doc.splitTextToSize(cleanText(inv.patient_address), 94) as string[];
    doc.text(addr.slice(0, 2), 20, y + 20);
  }

  const methodsUsed = payments.length ? [...new Set(payments.map((p) => cleanText(p.method)))].join(", ") : "Pending payment";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(`Status: ${inv.status === "partial" ? "Part-paid" : inv.status.toUpperCase()}`, 122, y + 11);
  doc.text(`Payment Method: ${methodsUsed}`, 122, y + 15.8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(balance > 0 ? ROSE[0] : TEAL[0], balance > 0 ? ROSE[1] : TEAL[1], balance > 0 ? ROSE[2] : TEAL[2]);
  doc.text(`Balance Payable: ${pdfMoney(balance)}`, 122, y + 20.8);

  if (isVoid && inv.void_reason) {
    y += 30;
    doc.setFillColor(255, 241, 242);
    doc.roundedRect(16, y, 178, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...ROSE);
    doc.text(`VOID INVOICE - Reason: ${cleanText(inv.void_reason)}`, 20, y + 5.2);
    y += 4;
  } else {
    y += 28;
  }

  // Itemised Charges Table
  y += 5;
  doc.setFillColor(...NAVY);
  doc.roundedRect(16, y, 178, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  doc.text("#", 19, y + 5.3);
  doc.text("TREATMENT / SERVICE DESCRIPTION", 27, y + 5.3);
  doc.text("SESSIONS", 114, y + 5.3, { align: "right" });
  doc.text("RATE (INR)", 138, y + 5.3, { align: "right" });
  doc.text("DISCOUNT", 162, y + 5.3, { align: "right" });
  doc.text("AMOUNT (INR)", 191, y + 5.3, { align: "right" });
  y += 8;

  items.forEach((it, idx) => {
    const descLines = doc.splitTextToSize(
      cleanText(it.description) + (showTax && it.tax > 0 ? ` (+${cleanText(s.tax.label)} ${it.tax_rate_bp / 100}%)` : ""),
      82,
    ) as string[];
    const rowH = Math.max(8.5, descLines.length * 4.2 + 3.5);
    if (y + rowH > 245) {
      doc.addPage();
      y = 20;
    }
    if (idx % 2 === 1) {
      doc.setFillColor(251, 250, 247);
      doc.rect(16, y, 178, rowH, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(16, y + rowH, 194, y + rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(String(idx + 1), 19, y + 5.3);

    doc.setTextColor(...INK);
    doc.text(descLines, 27, y + 5.3);
    doc.text(String(it.quantity), 114, y + 5.3, { align: "right" });
    doc.text(pdfMoney(it.unit_price, false), 138, y + 5.3, { align: "right" });
    doc.text(it.discount > 0 ? `- ${pdfMoney(it.discount, false)}` : "-", 162, y + 5.3, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(pdfMoney(it.total, false), 191, y + 5.3, { align: "right" });
    y += rowH;
  });

  // Totals & Amount in words
  y += 6;
  if (y > 225) {
    doc.addPage();
    y = 20;
  }

  const leftY = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text("Amount in words", 16, leftY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const wordsLines = doc.splitTextToSize(cleanText(amountInWords(inv.total)), 95) as string[];
  doc.text(wordsLines, 16, leftY + 8.5);
  let notesBottom = leftY + 8.5 + wordsLines.length * 4;

  if (inv.notes) {
    notesBottom += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("Treatment / Billing Notes", 16, notesBottom);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...MUTED);
    const noteLines = doc.splitTextToSize(cleanText(inv.notes), 95) as string[];
    doc.text(noteLines, 16, notesBottom + 4.2);
    notesBottom += 4.2 + noteLines.length * 3.8;
  }

  let ty = y;
  const summaryRow = (label: string, val: string, opts?: { bold?: boolean; color?: [number, number, number]; topRule?: boolean }) => {
    if (opts?.topRule) {
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.5);
      doc.line(122, ty + 1, 194, ty + 1);
      ty += 5.5;
    } else {
      ty += 5;
    }
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.bold ? 10 : 8.8);
    const c = opts?.color ?? INK;
    doc.setTextColor(...c);
    doc.text(label, 122, ty);
    doc.text(val, 194, ty, { align: "right" });
  };

  summaryRow("Subtotal", pdfMoney(inv.subtotal), { color: MUTED });
  if (inv.discount_total > 0) summaryRow("Discount", `- ${pdfMoney(inv.discount_total)}`, { color: MUTED });
  if (showTax) summaryRow(cleanText(s.tax.label), pdfMoney(inv.tax_total), { color: MUTED });
  summaryRow("Total Payable", pdfMoney(inv.total), { bold: true, color: NAVY, topRule: true });
  summaryRow("Amount Paid", pdfMoney(inv.paid), { color: TEAL });
  summaryRow("Balance Due", pdfMoney(balance), { bold: true, color: balance > 0 ? ROSE : NAVY });

  y = Math.max(notesBottom, ty) + 8;

  // Payments Received Table
  if (payments.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("PAYMENTS RECEIVED", 16, y);
    y += 3;
    doc.setFillColor(...TEAL_SOFT);
    doc.roundedRect(16, y, 178, 6.5, 1, 1, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEAL);
    doc.text("RECEIPT NO", 19, y + 4.4);
    doc.text("DATE", 68, y + 4.4);
    doc.text("PAYMENT METHOD & REFERENCE", 104, y + 4.4);
    doc.text("AMOUNT", 191, y + 4.4, { align: "right" });
    y += 6.5;

    payments.forEach((p) => {
      y += 5.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2);
      doc.setTextColor(...INK);
      doc.text(cleanText(p.receipt_no), 19, y);
      doc.text(fmtPdfDate(p.paid_on), 68, y);
      doc.text(cleanText(p.method + (p.reference ? ` (${p.reference})` : "")), 104, y);
      doc.setFont("helvetica", "bold");
      doc.text(pdfMoney(p.amount), 191, y, { align: "right" });
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(16, y + 1.8, 194, y + 1.8);
    });
    y += 4;
  }

  drawSignatureAndFooter(doc, s, y);
  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

export type PdfReceiptData = {
  receipt_no: string;
  amount: number;
  method: string;
  reference: string | null;
  paid_on: string;
  invoice_no: string;
  invoice_total: number;
  invoice_paid: number;
  patient_name: string;
  patient_code: string;
  received_by_name: string | null;
};

export function downloadReceiptPdf(p: PdfReceiptData, s: Settings, fileName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const headerBottom = drawBrandHeader(doc, s, 16, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text("PAYMENT RECEIPT", 194, 19, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(cleanText(p.receipt_no), 194, 25, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Date: ${fmtPdfDate(p.paid_on)}`, 194, 30.5, { align: "right" });

  let y = Math.max(headerBottom + 5, 42);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(16, y, 194, y);

  y += 8;
  doc.setFillColor(...TEAL_SOFT);
  doc.roundedRect(16, y, 178, 28, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Amount Received", 105, y + 8, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text(pdfMoney(p.amount), 105, y + 17.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...MUTED);
  doc.text(cleanText(amountInWords(p.amount)), 105, y + 23.5, { align: "center" });

  y += 38;
  const fields: [string, string][] = [
    ["Received From", `${cleanText(p.patient_name)} (${cleanText(p.patient_code)})`],
    ["Towards Invoice", cleanText(p.invoice_no)],
    ["Payment Method", cleanText(p.method + (p.reference ? `  |  Ref: ${p.reference}` : ""))],
    ["Received By", cleanText(p.received_by_name ?? "Clinic Desk")],
    ["Invoice Total", pdfMoney(p.invoice_total)],
    ["Remaining Balance on Invoice", pdfMoney(Math.max(0, p.invoice_total - p.invoice_paid))],
  ];

  fields.forEach(([label, val], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const fx = col === 0 ? 18 : 110;
    const fy = y + row * 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), fx, fy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(val, fx, fy + 5.2);
  });

  drawSignatureAndFooter(doc, s, y + 52);
  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

export function downloadReportPdf(opts: {
  clinicName: string;
  title: string;
  subtitle: string;
  kpis?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
  rightAlignCols?: number[];
  fileName: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(`${cleanText(opts.clinicName)} - ${cleanText(opts.title)}`, 16, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${cleanText(opts.subtitle)}  |  Generated ${new Date().toLocaleString("en-IN")}${IS_DEMO ? "  |  Demo Sample Data" : ""}`,
    16,
    23.5,
  );

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(16, 27, 194, 27);

  let y = 33;
  if (opts.kpis?.length) {
    const w = (178 - (opts.kpis.length - 1) * 3) / opts.kpis.length;
    opts.kpis.forEach((k, i) => {
      const kx = 16 + i * (w + 3);
      doc.setFillColor(251, 250, 247);
      doc.setDrawColor(...LINE);
      doc.roundedRect(kx, y, w, 15, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(cleanText(k.label).toUpperCase(), kx + 3, y + 5.2);
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(cleanText(k.value), kx + 3, y + 11.5);
    });
    y += 21;
  }

  const cols = opts.headers.length;
  const colW = 178 / cols;
  const rightSet = new Set(opts.rightAlignCols ?? []);

  const drawTableHeader = () => {
    doc.setFillColor(...NAVY);
    doc.roundedRect(16, y, 178, 7.5, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    opts.headers.forEach((h, i) => {
      const right = rightSet.has(i);
      const cx = right ? 16 + (i + 1) * colW - 2.5 : 16 + i * colW + 2.5;
      doc.text(cleanText(h).toUpperCase(), cx, y + 5, { align: right ? "right" : "left" });
    });
    y += 7.5;
  };

  drawTableHeader();

  opts.rows.forEach((r, idx) => {
    if (y + 7 > 280) {
      doc.addPage();
      y = 18;
      drawTableHeader();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(251, 250, 247);
      doc.rect(16, y, 178, 6.8, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(16, y + 6.8, 194, y + 6.8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    r.forEach((cell, i) => {
      const right = rightSet.has(i);
      const cx = right ? 16 + (i + 1) * colW - 2.5 : 16 + i * colW + 2.5;
      const text = cleanText(String(cell ?? "-")).slice(0, 34);
      doc.text(text, cx, y + 4.7, { align: right ? "right" : "left" });
    });
    y += 6.8;
  });

  doc.save(opts.fileName.endsWith(".pdf") ? opts.fileName : `${opts.fileName}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Detailed Physiotherapy Bill (session-wise statement for insurance   */
/* reimbursement), following the clinic's own bill format.             */
/* ------------------------------------------------------------------ */

export type DetailedBillData = {
  billNo: string;
  billDate: string; // ISO yyyy-mm-dd
  patientName: string;
  ageGender: string;
  referredBy: string;
  sessions: { date: string; particulars: string; amount: number }[]; // amount in paise
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function dayName(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return isNaN(+d) ? "-" : DAYS[d.getDay()];
}

export function downloadDetailedBillPdf(b: DetailedBillData, s: Settings, fileName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const sessions = [...b.sessions].sort((x, y) => x.date.localeCompare(y.date));
  const total = sessions.reduce((a, r) => a + r.amount, 0);

  const headerBottom = drawBrandHeader(doc, s, 16, 16);
  let y = Math.max(headerBottom + 5, 42);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(16, y, 194, y);

  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("DETAILED PHYSIOTHERAPY BILL", 105, y, { align: "center" });

  // Patient / bill information grid
  y += 6;
  const info: [string, string][] = [
    ["Name of the patient", b.patientName],
    ["Patient Age and Gender", b.ageGender || "-"],
    ["Referred by", b.referredBy || "-"],
    ["Treatment Start Date", sessions[0] ? fmtPdfDate(sessions[0].date) : "-"],
    ["Treatment End Date", sessions.length ? fmtPdfDate(sessions[sessions.length - 1].date) : "-"],
    ["Bill No.", b.billNo],
    ["Bill Date", fmtPdfDate(b.billDate)],
  ];
  const rowH = 7;
  doc.setLineWidth(0.25);
  doc.setDrawColor(...LINE);
  info.forEach(([k, v], i) => {
    const ry = y + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(...TEAL_SOFT);
      doc.rect(16, ry, 178, rowH, "F");
    }
    doc.rect(16, ry, 178, rowH, "S");
    doc.line(76, ry, 76, ry + rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(k, 19, ry + 4.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    doc.text(cleanText(v), 79, ry + 4.8);
  });
  y += info.length * rowH + 7;

  // Session table
  const cols = { sl: 16, date: 32, day: 62, part: 92, amt: 194 };
  const drawHead = () => {
    doc.setFillColor(...NAVY);
    doc.rect(16, y, 178, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Sl. No", cols.sl + 2.5, y + 5.3);
    doc.text("Date", cols.date + 2, y + 5.3);
    doc.text("Day", cols.day + 2, y + 5.3);
    doc.text("Particulars", cols.part + 2, y + 5.3);
    doc.text("Amount (Rs.)", cols.amt - 2.5, y + 5.3, { align: "right" });
    y += 8;
  };
  drawHead();
  const lineH = 6.4;
  sessions.forEach((r, i) => {
    if (y + lineH > pageH - 60) {
      doc.addPage();
      y = 20;
      drawHead();
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 248, 243);
      doc.rect(16, y, 178, lineH, "F");
    }
    doc.setDrawColor(...LINE);
    doc.line(16, y + lineH, 194, y + lineH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...INK);
    doc.text(String(i + 1), cols.sl + 2.5, y + 4.4);
    doc.text(fmtPdfDate(r.date), cols.date + 2, y + 4.4);
    doc.text(dayName(r.date), cols.day + 2, y + 4.4);
    doc.text(cleanText(r.particulars), cols.part + 2, y + 4.4);
    doc.text(pdfMoney(r.amount, false), cols.amt - 2.5, y + 4.4, { align: "right" });
    y += lineH;
  });

  // Total row
  doc.setFillColor(...TEAL_SOFT);
  doc.rect(16, y, 178, 8.5, "F");
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.line(16, y, 194, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text(`Total ${sessions.length} session${sessions.length === 1 ? "" : "s"}`, cols.sl + 2.5, y + 5.6);
  doc.text(pdfMoney(total), cols.amt - 2.5, y + 5.6, { align: "right" });
  y += 13;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Amount in Words:", 16, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.text(cleanText(amountInWords(total)), 46, y, { maxWidth: 148 });
  y += 6;

  drawSignatureAndFooter(doc, s, y);
  doc.save(fileName);
}
