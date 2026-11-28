import { jsPDF } from "jspdf";
import {
  amountInWords,
  dayOfWeekName,
  formatINR,
  formatRefHeaderDate,
  formatRefSessionDate,
  formatRupeeNumber,
  rupeesInWords,
} from "../shared/billing";
import type { DocumentSignatureRecord } from "../shared/types";
import type { Settings } from "../server/settings";
import { BRAND_LOGO } from "./brand";

const NAVY: [number, number, number] = [11, 31, 58];
const TEAL: [number, number, number] = [22, 151, 141];
const TEAL_SOFT: [number, number, number] = [238, 250, 248];
const INK: [number, number, number] = [28, 37, 52];
const MUTED: [number, number, number] = [91, 102, 118];
const LINE: [number, number, number] = [226, 221, 210];
const ROSE: [number, number, number] = [190, 18, 60];
const AMBER: [number, number, number] = [180, 83, 9];

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

function pdfMoney(paise: number | null | undefined, withPrefix = true): string {
  const p = paise ?? 0;
  const neg = p < 0;
  const raw = formatINR(Math.abs(p), { symbol: false });
  return `${neg ? "- " : ""}${withPrefix ? "Rs. " : ""}${raw}`;
}

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

function tryAddPngOrJpeg(doc: jsPDF, dataUrl: string | null | undefined, x: number, y: number, w: number, h: number) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return false;
  try {
    const fmt = dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
    doc.addImage(dataUrl, fmt, x, y, w, h, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

function drawBrandHeader(doc: jsPDF, s: Settings, x: number, y: number): number {
  if (!tryAddPngOrJpeg(doc, s.clinic.logoDataUrl, x, y, 13, 13) && !tryAddPngOrJpeg(doc, BRAND_LOGO, x, y, 13, 13)) {
    doc.setFillColor(...NAVY);
    doc.roundedRect(x, y, 13, 13, 3, 3, "F");
    doc.setDrawColor(63, 181, 170);
    doc.setLineWidth(1.1);
    doc.line(x + 3.6, y + 9.2, x + 6.5, y + 4.8);
    doc.line(x + 6.5, y + 4.8, x + 9.4, y + 9.2);
    doc.setFillColor(92, 200, 224);
    doc.circle(x + 6.5, y + 3.2, 0.9, "F");
  }

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

function drawSignatureAndFooter(
  doc: jsPDF,
  s: Settings,
  startY: number,
  signature?: DocumentSignatureRecord | null,
) {
  const pageH = doc.internal.pageSize.getHeight();
  let y = Math.max(startY + 8, pageH - 58);
  if (y > pageH - 46) {
    doc.addPage();
    y = 28;
  }

  if (s.invoice.showStamp) {
    if (!tryAddPngOrJpeg(doc, s.clinic.stampDataUrl, 19, y + 1, 22, 22)) {
      doc.setDrawColor(...LINE);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.circle(30, y + 12, 11, "S");
      doc.setLineDashPattern([], 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text("Clinic Stamp", 30, y + 12.8, { align: "center" });
    }
  }

  if (s.invoice.showSignature || signature) {
    if (signature?.imageDataUrl) {
      tryAddPngOrJpeg(doc, signature.imageDataUrl, 143, y + 1, 46, 15);
    }
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.line(138, y + 17, 194, y + 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(cleanText(signature ? signature.signerName : "Authorised Signatory"), 166, y + 21.2, { align: "center" });

    let subY = y + 25;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...MUTED);
    if (signature?.signerQualification) {
      doc.text(cleanText(signature.signerQualification), 166, subY, { align: "center" });
      subY += 3.6;
    }
    doc.text(cleanText(s.clinic.name), 166, subY, { align: "center" });
    if (signature?.signedAt) {
      doc.text(`Date: ${fmtPdfDate(signature.signedAt.slice(0, 10))}`, 166, subY + 3.6, { align: "center" });
    }
  }

  const fy = pageH - 16;
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
  const terms = [
    s.invoice.terms ? cleanText(s.invoice.terms) : "",
    IS_DEMO ? "Sample demonstration document (fictional patient data)" : "",
  ]
    .filter(Boolean)
    .join("  |  ");
  if (terms) doc.text(terms, 105, fy + 4, { align: "center" });
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
  signature?: DocumentSignatureRecord | null;
};

export function downloadInvoicePdf(data: PdfInvoiceData, s: Settings, fileName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { invoice: inv, items, payments } = data;
  const isVoid = inv.status === "void";
  const balance = isVoid ? 0 : Math.max(0, inv.total - inv.paid);
  const showTax = inv.tax_total > 0;

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

  drawSignatureAndFooter(doc, s, y, data.signature);
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
  signature?: DocumentSignatureRecord | null;
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

  drawSignatureAndFooter(doc, s, y + 52, p.signature);
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
  signature?: DocumentSignatureRecord | null;
  settings?: Settings;
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
    if (y + 7 > 275) {
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
      const text = cleanText(String(cell ?? "-")).slice(0, 38);
      doc.text(text, cx, y + 4.7, { align: right ? "right" : "left" });
    });
    y += 6.8;
  });

  if (opts.settings && opts.signature) {
    drawSignatureAndFooter(doc, opts.settings, y + 4, opts.signature);
  }
  doc.save(opts.fileName.endsWith(".pdf") ? opts.fileName : `${opts.fileName}.pdf`);
}

/* ============================================================================
   DETAILED PHYSIOTHERAPY BILL — Reference-Matched Multi-Page A4 Generator
   Follows client reference `Namma Physio Invoice CN - Mar 16 to May 14_Updated.docx`
   ============================================================================ */

export type DetailedBillData = {
  billNo: string;
  billDate: string; // YYYY-MM-DD
  treatmentStartDate?: string; // YYYY-MM-DD
  treatmentEndDate?: string; // YYYY-MM-DD
  patientName: string;
  ageGender: string;
  referredBy: string;
  sessions: { date: string; particulars: string; amount: number }[]; // amount in paise
  signature?: DocumentSignatureRecord | null;
};

/**
 * Builds the exact multi-page A4 jsPDF document matching the client's Word reference:
 * - Times serif typography (11pt)
 * - Exact 5-column proportions: [18.47%, 15.02%, 13.89%, 35.41%, 17.21%]
 * - Bordered patient information grid + grey header row (#D4D2D2) repeated on every page
 * - Dynamic session count & exact Indian numbering ("Amount in Words: Rupees ... Only")
 * - Professional signature & clinic stamp area below totals
 */
export function buildDetailedBillPdfDoc(b: DetailedBillData, s: Settings): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const leftX = 20;
  const tableW = 170; // 20mm left & right margins matching 1-inch / reference layout

  // Exact column widths matching docx grid [1569, 1276, 1180, 3008, 1462] (sum = 8495)
  const wSl = +(tableW * (1569 / 8495)).toFixed(2); // 31.40mm
  const wDate = +(tableW * (1276 / 8495)).toFixed(2); // 25.54mm
  const wDay = +(tableW * (1180 / 8495)).toFixed(2); // 23.61mm
  const wPart = +(tableW * (3008 / 8495)).toFixed(2); // 60.19mm
  const wAmt = +(tableW - (wSl + wDate + wDay + wPart)).toFixed(2); // 29.26mm

  const xSl = leftX;
  const xDate = xSl + wSl;
  const xDay = xDate + wDate;
  const xPart = xDay + wDay;
  const xAmt = xPart + wPart;
  const rightX = leftX + tableW;

  const sessions = [...b.sessions].sort((a, c) => a.date.localeCompare(c.date));
  const totalPaise = sessions.reduce((acc, r) => acc + r.amount, 0);
  const startDate = b.treatmentStartDate || sessions[0]?.date || "";
  const endDate = b.treatmentEndDate || sessions[sessions.length - 1]?.date || "";

  // Subtle clinic header above the reference table so insurance reviewers have verified clinic details
  doc.setFont("times", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0);
  doc.text(cleanText(s.clinic.name).toUpperCase(), 105, 15, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const subLine = [s.clinic.address ? cleanText(s.clinic.address) : "", s.clinic.phone ? `Ph: ${cleanText(s.clinic.phone)}` : ""]
    .filter(Boolean)
    .join("  |  ");
  const subWrapped = doc.splitTextToSize(subLine, tableW) as string[];
  doc.text(subWrapped, 105, 19.5, { align: "center" });

  let y = 20 + subWrapped.length * 3.8 + 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.28);
  doc.setTextColor(0, 0, 0);

  // Row 0: DETAILED PHYSIOTHERAPY BILL (spans cols 1-4 | col 5 cell as in reference TableGrid)
  const titleH = 8.5;
  doc.rect(xSl, y, wSl + wDate + wDay + wPart, titleH, "S");
  doc.rect(xAmt, y, wAmt, titleH, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  doc.text("DETAILED PHYSIOTHERAPY BILL", xSl + 2.5, y + 5.7);
  y += titleH;

  // Rows 1–7: Patient Information Grid (Cols 1+2 right-aligned bold label | Cols 3+4 centered value | Col 5 cell)
  const labelW = wSl + wDate;
  const valW = wDay + wPart;
  const infoRows: [string, string][] = [
    ["Name of the patient", b.patientName],
    ["Patient Age and Gender", b.ageGender || ""],
    ["Referred by", b.referredBy || ""],
    ["Treatment Start Date", startDate ? formatRefHeaderDate(startDate) : ""],
    ["Treatment End Date", endDate ? formatRefHeaderDate(endDate) : ""],
    ["Bill No.", b.billNo],
    ["Bill Date", b.billDate ? formatRefHeaderDate(b.billDate) : ""],
  ];

  const infoH = 7.4;
  for (const [label, val] of infoRows) {
    doc.rect(xSl, y, labelW, infoH, "S");
    doc.rect(xDay, y, valW, infoH, "S");
    doc.rect(xAmt, y, wAmt, infoH, "S");

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(label, xDay - 2.2, y + 5, { align: "right" });

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const fitVal = (doc.splitTextToSize(cleanText(val), valW - 4) as string[])[0] ?? "";
    doc.text(fitVal, xDay + valW / 2, y + 5, { align: "center" });
    y += infoH;
  }

  // Row 8: Blank grid spacer row (exact match to R8 in reference docx)
  const spacerH = 6.5;
  doc.rect(xSl, y, wSl, spacerH, "S");
  doc.rect(xDate, y, wDate, spacerH, "S");
  doc.rect(xDay, y, wDay, spacerH, "S");
  doc.rect(xPart, y, wPart, spacerH, "S");
  doc.rect(xAmt, y, wAmt, spacerH, "S");
  y += spacerH;

  // Shaded 5-column table header (repeated on every page!)
  const drawSessionHeader = () => {
    const hh = 8;
    doc.setFillColor(190, 188, 188);
    doc.rect(xSl, y, tableW, hh, "FD");
    doc.line(xDate, y, xDate, y + hh);
    doc.line(xDay, y, xDay, y + hh);
    doc.line(xPart, y, xPart, y + hh);
    doc.line(xAmt, y, xAmt, y + hh);

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Sl. No", xSl + wSl / 2, y + 5.4, { align: "center" });
    doc.text("Date", xDate + wDate / 2, y + 5.4, { align: "center" });
    doc.text("Day", xDay + wDay / 2, y + 5.4, { align: "center" });
    doc.text("Particulars", xPart + wPart / 2, y + 5.4, { align: "center" });
    doc.text("Amount (Rs.)", xAmt + 2, y + 5.4);
    y += hh;
  };

  drawSessionHeader();

  // Session rows with automatic page breaks and repeated headers
  const bottomLimit = pageH - 22;
  sessions.forEach((row, idx) => {
    const partLines = doc.splitTextToSize(cleanText(row.particulars || "Physiotherapy Charges"), wPart - 4) as string[];
    const rh = Math.max(7.2, partLines.length * 4.8 + 2.4);

    if (y + rh > bottomLimit) {
      doc.addPage();
      y = 20;
      drawSessionHeader();
    }

    doc.rect(xSl, y, wSl, rh, "S");
    doc.rect(xDate, y, wDate, rh, "S");
    doc.rect(xDay, y, wDay, rh, "S");
    doc.rect(xPart, y, wPart, rh, "S");
    doc.rect(xAmt, y, wAmt, rh, "S");

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(String(idx + 1), xSl + wSl / 2, y + 5, { align: "center" });
    doc.text(formatRefSessionDate(row.date), xDate + 2, y + 5);
    doc.text(dayOfWeekName(row.date), xDay + 2, y + 5);
    doc.text(partLines, xPart + 2, y + 5);
    doc.text(formatRupeeNumber(row.amount, false), rightX - 2.2, y + 5, { align: "right" });
    y += rh;
  });

  // Ensure Totals + Amount in Words fit cleanly without orphan split
  const wordsText = `Amount in Words: ${cleanText(rupeesInWords(totalPaise))}`;
  const wordsLines = doc.splitTextToSize(wordsText, tableW - 5) as string[];
  const wordsH = Math.max(8.5, wordsLines.length * 5 + 3.5);
  const totalsBlockH = spacerH + 8 + wordsH;

  if (y + totalsBlockH > bottomLimit) {
    doc.addPage();
    y = 20;
    drawSessionHeader();
  }

  // Blank spacer row before Total row (matches T2_End_1 in reference docx)
  doc.rect(xSl, y, wSl, spacerH, "S");
  doc.rect(xDate, y, wDate, spacerH, "S");
  doc.rect(xDay, y, wDay, spacerH, "S");
  doc.rect(xPart, y, wPart, spacerH, "S");
  doc.rect(xAmt, y, wAmt, spacerH, "S");
  y += spacerH;

  // Total N sessions row
  const totH = 8;
  doc.rect(xSl, y, wSl, totH, "S");
  doc.rect(xDate, y, wDate, totH, "S");
  doc.rect(xDay, y, wDay, totH, "S");
  doc.rect(xPart, y, wPart, totH, "S");
  doc.rect(xAmt, y, wAmt, totH, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(`Total ${sessions.length} session${sessions.length === 1 ? "" : "s"}`, xSl + wSl / 2, y + 5.4, {
    align: "center",
  });
  doc.text(formatRupeeNumber(totalPaise, true), rightX - 2.2, y + 5.4, { align: "right" });
  y += totH;

  // Amount in Words row
  doc.rect(xSl, y, tableW, wordsH, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(wordsLines, xSl + 2.5, y + 5.6);
  y += wordsH;

  // Signature & Clinic Stamp Block below totals (client-requested enhancement)
  const sigBlockH = 38;
  if (y + sigBlockH > pageH - 14) {
    doc.addPage();
    y = 24;
  } else {
    y += 8;
  }

  if (s.invoice.showStamp) {
    if (!tryAddPngOrJpeg(doc, s.clinic.stampDataUrl, leftX + 4, y, 24, 24)) {
      doc.setDrawColor(150, 150, 150);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.circle(leftX + 16, y + 12, 11.5, "S");
      doc.setLineDashPattern([], 0);
      doc.setFont("times", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text("Clinic Stamp", leftX + 16, y + 12.8, { align: "center" });
    }
  }

  const sigCenterX = rightX - 30;
  if (b.signature?.imageDataUrl) {
    tryAddPngOrJpeg(doc, b.signature.imageDataUrl, sigCenterX - 24, y, 48, 16);
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(sigCenterX - 28, y + 17.5, sigCenterX + 28, y + 17.5);

  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  const signerLabel = b.signature?.signerName || s.clinic.signerName || "Sunil Kumar";
  doc.text(cleanText(signerLabel), sigCenterX, y + 22, { align: "center" });

  let metaY = y + 26.2;
  doc.setFont("times", "normal");
  doc.setFontSize(9.2);
  const qual = b.signature?.signerQualification || s.clinic.signerQualification || "";
  if (qual) {
    doc.text(cleanText(qual), sigCenterX, metaY, { align: "center" });
    metaY += 4;
  }
  doc.text(cleanText(s.clinic.name), sigCenterX, metaY, { align: "center" });
  metaY += 4;
  if (b.signature?.signedAt) {
    doc.text(`Signed Date: ${formatRefHeaderDate(b.signature.signedAt.slice(0, 10))}`, sigCenterX, metaY, {
      align: "center",
    });
  }

  if (IS_DEMO) {
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Sample demonstration document (fictional patient data)", 105, pageH - 8, { align: "center" });
  }

  return doc;
}

export function downloadDetailedBillPdf(b: DetailedBillData, s: Settings, fileName: string) {
  const doc = buildDetailedBillPdfDoc(b, s);
  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

export function generateDetailedBillPdfFile(b: DetailedBillData, s: Settings, fileName: string): File {
  const doc = buildDetailedBillPdfDoc(b, s);
  const cleanName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  const blob = doc.output("blob");
  return new File([blob], cleanName, { type: "application/pdf" });
}

/**
 * Shares a generated PDF file via the smartphone's native share sheet (e.g. WhatsApp)
 * when supported by the browser/OS, or downloads the PDF cleanly with an honest fallback.
 */
export async function shareOrDownloadPdfFile(opts: {
  file: File;
  title: string;
}): Promise<{ method: "native_share" | "downloaded" | "cancelled" }> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof nav.share === "function" && typeof nav.canShare === "function") {
    try {
      if (nav.canShare({ files: [opts.file] })) {
        await nav.share({
          files: [opts.file],
          title: opts.title,
        });
        return { method: "native_share" };
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        return { method: "cancelled" };
      }
      // Fall through to reliable download fallback
    }
  }

  const url = URL.createObjectURL(opts.file);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { method: "downloaded" };
}
