import { calcDetailedBill, calcInvoice, financialYear, formatDocNumber, paymentStatus, type LineInput } from "../shared/billing";
import {
  can,
  type AppointmentStatus,
  type DetailedBillFull,
  type DetailedBillStatus,
  type DetailedBillSummary,
  type DocumentSignatureRecord,
  type Permission,
  type Role,
  type SignableDocumentType,
  type SessionUser,
} from "../shared/types";
import { defaultSettings, type Settings } from "../server/settings";

const STORAGE_KEY = "npb_demo_sandbox_v2";

type DemoUser = {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  active: number;
  must_change_password: number;
  last_login_at: string | null;
};

type DemoPatient = {
  id: number;
  patient_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  admin_notes: string | null;
  consent_recorded_at: string | null;
  anonymised_at: string | null;
  created_at: string;
  updated_at: string;
};

type DemoNote = {
  id: number;
  patient_id: number;
  author_id: number;
  note: string;
  created_at: string;
};

type DemoService = {
  id: number;
  name: string;
  default_price: number;
  taxable: number;
  active: number;
};

type DemoInvoice = {
  id: number;
  invoice_no: string;
  patient_id: number;
  invoice_date: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  paid: number;
  status: "unpaid" | "partial" | "paid" | "void";
  notes: string | null;
  void_reason: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

type DemoInvoiceItem = {
  id: number;
  invoice_id: number;
  position: number;
  service_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate_bp: number;
  tax: number;
  total: number;
};

type DemoPayment = {
  id: number;
  receipt_no: string;
  invoice_id: number;
  amount: number;
  method: string;
  reference: string | null;
  paid_on: string;
  received_by: number;
  created_at: string;
};

type DemoAppointment = {
  id: number;
  patient_id: number;
  visit_type: "clinic" | "home";
  date: string;
  time: string;
  physiotherapist: string | null;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DemoAudit = {
  id: number;
  at: string;
  username: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: string | null;
};

type DemoBackupFile = {
  file: string;
  name: string;
  destination: string;
  size: number;
  createdAt: string;
  encrypted: boolean;
  kind: string;
};

type DemoSavedSig = {
  userId: number;
  signerName: string;
  signerQualification: string;
  imageDataUrl: string;
  updatedAt: string;
};

type DemoDetailedBillRow = {
  id: number;
  bill_no: string;
  version: number;
  parent_bill_id: number | null;
  superseded_by_id: number | null;
  patient_id: number;
  patient_name: string;
  patient_age_gender: string;
  referred_by: string;
  treatment_start_date: string;
  treatment_end_date: string;
  bill_date: string;
  default_charge: number;
  total_sessions: number;
  total_amount: number;
  amount_in_words: string;
  status: DetailedBillStatus;
  signed_at: string | null;
  shared_at: string | null;
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

type DemoDetailedSessionRow = {
  id: number;
  detailed_bill_id: number;
  sl_no: number;
  session_date: string;
  day_name: string;
  particulars: string;
  amount: number;
  source_appointment_id: number | null;
};

type DemoState = {
  seedDate: string;
  activeUserId: number | null;
  settings: Settings;
  counters: Record<string, number>;
  users: DemoUser[];
  patients: DemoPatient[];
  clinicalNotes: DemoNote[];
  services: DemoService[];
  invoices: DemoInvoice[];
  invoiceItems: DemoInvoiceItem[];
  payments: DemoPayment[];
  appointments: DemoAppointment[];
  savedSignatures: DemoSavedSig[];
  docSignatures: DocumentSignatureRecord[];
  detailedBills: DemoDetailedBillRow[];
  detailedBillSessions: DemoDetailedSessionRow[];
  audit: DemoAudit[];
  backups: DemoBackupFile[];
};

export class DemoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function shiftDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function isoWeekKey(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.floor(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getUTCDay()) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function buildSeedState(): DemoState {
  const t = todayIST();
  const now = new Date().toISOString();
  const settings: Settings = {
    ...structuredClone(defaultSettings),
    clinic: {
      ...defaultSettings.clinic,
      email: "care@nammaphysiocentre.example",
      registrationNote: "JP Nagar 8th Phase, Bengaluru · Sample Demo Environment",
    },
    physiotherapists: ["Dr. Sunil Kumar", "Dr. Kavitha Nair"],
    backup: {
      schedule: "daily",
      dailyTime: "20:00",
      destinations: ["E:\\NammaPhysioBackups"],
      keep: 30,
      encrypt: true,
    },
  };

  const users: DemoUser[] = [
    { id: 1, username: "dr.sunil", display_name: "Dr. Sunil Kumar", role: "admin", active: 1, must_change_password: 0, last_login_at: now },
    { id: 2, username: "dr.kavitha", display_name: "Dr. Kavitha Nair", role: "physiotherapist", active: 1, must_change_password: 0, last_login_at: shiftDays(t, -1) + "T09:15:00Z" },
    { id: 3, username: "reception", display_name: "Ramesh Gowda", role: "reception", active: 1, must_change_password: 0, last_login_at: now },
  ];

  const services: DemoService[] = [
    { id: 1, name: "Physiotherapy Consultation & Assessment", default_price: 60000, taxable: 0, active: 1 },
    { id: 2, name: "Standard Physiotherapy Session (Clinic)", default_price: 70000, taxable: 0, active: 1 },
    { id: 3, name: "Post-Surgical / Joint Replacement Rehab Session", default_price: 85000, taxable: 0, active: 1 },
    { id: 4, name: "Knee Osteoarthritis & Joint Mobility Session", default_price: 70000, taxable: 0, active: 1 },
    { id: 5, name: "Sports Injury Rehabilitation Session", default_price: 80000, taxable: 0, active: 1 },
    { id: 6, name: "Back & Neck Pain Manual + Exercise Therapy", default_price: 75000, taxable: 0, active: 1 },
    { id: 7, name: "Shoulder Pain Rehabilitation Session", default_price: 75000, taxable: 0, active: 1 },
    { id: 8, name: "Home Visit Physiotherapy (JP Nagar & nearby)", default_price: 110000, taxable: 0, active: 1 },
    { id: 9, name: "6-Session Rehabilitation Package", default_price: 390000, taxable: 0, active: 1 },
    { id: 10, name: "10-Session Post-Surgical Rehab Package", default_price: 780000, taxable: 0, active: 1 },
  ];

  const patients: DemoPatient[] = [
    {
      id: 1, patient_code: "NPC-P-00001", name: "Raghavendra Rao", phone: "+91 98450 11234", email: "raghavendra.rao@example.com",
      gender: "Male", date_of_birth: "1962-04-14", address: "No. 42, 3rd Main, 7th Phase, J. P. Nagar, Bengaluru 560078",
      emergency_contact: "Savitha Rao (Spouse) · +91 98450 11235", admin_notes: "Prefers morning 9:30 AM slots. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -65) + "T10:00:00Z", anonymised_at: null, created_at: shiftDays(t, -65) + "T10:00:00Z", updated_at: now,
    },
    {
      id: 2, patient_code: "NPC-P-00002", name: "Ananya Kulkarni", phone: "+91 99001 44521", email: "ananya.k@example.com",
      gender: "Female", date_of_birth: "1995-08-22", address: "Brigade Millenium Rd, Puttenahalli, J. P. Nagar 7th Phase, Bengaluru 560078",
      emergency_contact: "Rohit Kulkarni · +91 99001 44522", admin_notes: "Evening sessions after 5:30 PM on weekdays. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -48) + "T17:30:00Z", anonymised_at: null, created_at: shiftDays(t, -48) + "T17:30:00Z", updated_at: now,
    },
    {
      id: 3, patient_code: "NPC-P-00003", name: "Meenakshi Sundaram", phone: "+91 98802 77890", email: "meenakshi.s@example.com",
      gender: "Female", date_of_birth: "1968-11-03", address: "14th Cross, RBI Layout, J. P. Nagar 7th Phase, Bengaluru 560078",
      emergency_contact: "Vignesh S. (Son) · +91 98802 77891", admin_notes: "Bilateral knee osteoarthritis management. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -90) + "T11:00:00Z", anonymised_at: null, created_at: shiftDays(t, -90) + "T11:00:00Z", updated_at: shiftDays(t, -2) + "T11:00:00Z",
    },
    {
      id: 4, patient_code: "NPC-P-00004", name: "Karthikeya Gowda", phone: "+91 97412 33098", email: "karthik.gowda@example.com",
      gender: "Male", date_of_birth: "1999-01-19", address: "2nd Cross, Konanakunte, Kanakapura Main Road, Bengaluru 560062",
      emergency_contact: "Manjunath Gowda · +91 97412 33099", admin_notes: "State-level badminton player; return-to-sport rehab. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -24) + "T18:00:00Z", anonymised_at: null, created_at: shiftDays(t, -24) + "T18:00:00Z", updated_at: now,
    },
    {
      id: 5, patient_code: "NPC-P-00005", name: "Lakshmi Narayanan", phone: "+91 94481 66543", email: null,
      gender: "Male", date_of_birth: "1954-07-08", address: "Flat 204, Royal County Layout, Jambusawari Dinne, J. P. Nagar 8th Phase, Bengaluru 560083",
      emergency_contact: "Deepa Narayanan (Daughter) · +91 94481 66544", admin_notes: "Home visit patient — ground-floor access, walker assisted. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -35) + "T09:30:00Z", anonymised_at: null, created_at: shiftDays(t, -35) + "T09:30:00Z", updated_at: shiftDays(t, -1) + "T16:00:00Z",
    },
    {
      id: 6, patient_code: "NPC-P-00006", name: "Priya Deshpande", phone: "+91 96114 88210", email: "priya.deshpande@example.com",
      gender: "Female", date_of_birth: "1988-03-27", address: " Gottigere, Bannerghatta Main Road, Bengaluru 560083",
      emergency_contact: "Nikhil Deshpande · +91 96114 88211", admin_notes: "Software architect — desk-related cervical & lumbar pain. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -19) + "T12:00:00Z", anonymised_at: null, created_at: shiftDays(t, -19) + "T12:00:00Z", updated_at: shiftDays(t, -3) + "T12:00:00Z",
    },
    {
      id: 7, patient_code: "NPC-P-00007", name: "Suresh Babu M.", phone: "+91 98453 20911", email: "sureshbabu.m@example.com",
      gender: "Male", date_of_birth: "1974-09-12", address: "5th Cross, Arekere MICO Layout, Bannerghatta Road, Bengaluru 560076",
      emergency_contact: "Rekha Suresh · +91 98453 20912", admin_notes: "Right shoulder adhesive capsulitis (frozen shoulder). Fictional sample record.",
      consent_recorded_at: shiftDays(t, -42) + "T10:30:00Z", anonymised_at: null, created_at: shiftDays(t, -42) + "T10:30:00Z", updated_at: shiftDays(t, -6) + "T10:30:00Z",
    },
    {
      id: 8, patient_code: "NPC-P-00008", name: "Divya Venkatesh", phone: "+91 99860 51234", email: "divya.v@example.com",
      gender: "Female", date_of_birth: "1982-12-15", address: "7th Main, BTM Layout 2nd Stage, Bengaluru 560076",
      emergency_contact: "Venkatesh R. · +91 99860 51235", admin_notes: "Medial meniscus tear conservative rehab. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -55) + "T16:15:00Z", anonymised_at: null, created_at: shiftDays(t, -55) + "T16:15:00Z", updated_at: shiftDays(t, -5) + "T16:15:00Z",
    },
    {
      id: 9, patient_code: "NPC-P-00009", name: "Arjun Nair", phone: "+91 97390 19402", email: "arjun.nair@example.com",
      gender: "Male", date_of_birth: "1991-06-30", address: "38th Cross, Jayanagar 9th Block, Bengaluru 560069",
      emergency_contact: "Meera Nair · +91 97390 19403", admin_notes: "Post-arthroscopic partial meniscectomy rehab. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -80) + "T11:45:00Z", anonymised_at: null, created_at: shiftDays(t, -80) + "T11:45:00Z", updated_at: shiftDays(t, -14) + "T11:45:00Z",
    },
    {
      id: 10, patient_code: "NPC-P-00010", name: "Shanthamma R.", phone: "+91 94805 62109", email: null,
      gender: "Female", date_of_birth: "1958-02-10", address: "Kothnur Dinne Main Road, J. P. Nagar 8th Phase, Bengaluru 560083",
      emergency_contact: "Harish Kumar (Son) · +91 94805 62110", admin_notes: "Home-visit knee arthritis & sit-to-stand mobility training. Fictional sample record.",
      consent_recorded_at: shiftDays(t, -12) + "T15:00:00Z", anonymised_at: null, created_at: shiftDays(t, -12) + "T15:00:00Z", updated_at: shiftDays(t, -1) + "T15:00:00Z",
    },
  ];

  const clinicalNotes: DemoNote[] = [
    {
      id: 1, patient_id: 1, author_id: 1, created_at: shiftDays(t, -14) + "T09:50:00Z",
      note: "Week 4 Post-Right TKR review: Knee flexion improved from 88° to 106°; extension lag reduced to <3°. Minimal effusion. Progressed closed-chain mini-squats, step-ups (4 inch) and independent cane-assisted outdoor gait.",
    },
    {
      id: 2, patient_id: 1, author_id: 1, created_at: t + "T09:55:00Z",
      note: "Session 9/10: Active knee flexion 114°, full terminal extension achieved. Reciprocal stair ascent comfortable with handrail. Reviewed home exercise programme and icing protocol.",
    },
    {
      id: 3, patient_id: 2, author_id: 2, created_at: shiftDays(t, -4) + "T18:10:00Z",
      note: "Post-ACL Reconstruction (Week 7): Symmetric full extension, flexion 128°. Single-leg balance 30s stable; initiated controlled lateral band walks and neuromuscular control drills per surgeon protocol.",
    },
    {
      id: 4, patient_id: 3, author_id: 1, created_at: shiftDays(t, -2) + "T11:25:00Z",
      note: "Bilateral Knee Osteoarthritis: Morning stiffness reduced from ~35 mins to 10 mins. Quadriceps & hip abductor strengthening tolerated well without next-day flare. Advised activity pacing on stairs.",
    },
    {
      id: 5, patient_id: 5, author_id: 1, created_at: shiftDays(t, -3) + "T16:30:00Z",
      note: "Home visit — Post-proximal femur fracture fixation (ORIF, Week 6): Weight-bearing as tolerated per orthopaedic discharge summary. Practised safe bed-to-chair transfers, walker gait across hallway, and ankle/hip isometric routine.",
    },
  ];

  const appointments: DemoAppointment[] = [
    // Today's 5 appointments (mix of completed, confirmed, clinic & home)
    { id: 1, patient_id: 1, visit_type: "clinic", date: t, time: "09:30", physiotherapist: "Dr. Sunil Kumar", status: "completed", notes: "Post-TKR Session 9 of 10", created_at: now, updated_at: now },
    { id: 2, patient_id: 4, visit_type: "clinic", date: t, time: "10:30", physiotherapist: "Dr. Kavitha Nair", status: "completed", notes: "Ankle & knee proprioception progression", created_at: now, updated_at: now },
    { id: 3, patient_id: 3, visit_type: "clinic", date: t, time: "11:30", physiotherapist: "Dr. Sunil Kumar", status: "confirmed", notes: "Knee OA strengthening follow-up", created_at: now, updated_at: now },
    { id: 4, patient_id: 5, visit_type: "home", date: t, time: "15:30", physiotherapist: "Dr. Sunil Kumar", status: "confirmed", notes: "Home visit · Royal County JP Nagar 8th Phase", created_at: now, updated_at: now },
    { id: 5, patient_id: 2, visit_type: "clinic", date: t, time: "18:00", physiotherapist: "Dr. Kavitha Nair", status: "requested", notes: "Requested evening slot", created_at: now, updated_at: now },
    // Upcoming days
    { id: 6, patient_id: 10, visit_type: "home", date: shiftDays(t, 1), time: "10:00", physiotherapist: "Dr. Sunil Kumar", status: "confirmed", notes: "Home visit · Kothnur Dinne", created_at: now, updated_at: now },
    { id: 7, patient_id: 6, visit_type: "clinic", date: shiftDays(t, 1), time: "12:00", physiotherapist: "Dr. Kavitha Nair", status: "confirmed", notes: "Cervical & ergonomic review", created_at: now, updated_at: now },
    { id: 8, patient_id: 7, visit_type: "clinic", date: shiftDays(t, 2), time: "10:30", physiotherapist: "Dr. Sunil Kumar", status: "confirmed", notes: "Frozen shoulder mobility progression", created_at: now, updated_at: now },
    { id: 9, patient_id: 1, visit_type: "clinic", date: shiftDays(t, 2), time: "09:30", physiotherapist: "Dr. Sunil Kumar", status: "confirmed", notes: "Final session of 10-session package", created_at: now, updated_at: now },
    { id: 10, patient_id: 8, visit_type: "clinic", date: shiftDays(t, 3), time: "17:00", physiotherapist: "Dr. Kavitha Nair", status: "confirmed", notes: "Meniscus rehab strength check", created_at: now, updated_at: now },
    // Past completed sessions for patient session history
    { id: 11, patient_id: 1, visit_type: "home", date: shiftDays(t, -18), time: "15:00", physiotherapist: "Dr. Sunil Kumar", status: "completed", notes: "Initial post-op home visit", created_at: now, updated_at: now },
    { id: 12, patient_id: 1, visit_type: "clinic", date: shiftDays(t, -11), time: "09:30", physiotherapist: "Dr. Sunil Kumar", status: "completed", notes: "Clinic gait & ROM training", created_at: now, updated_at: now },
    { id: 13, patient_id: 1, visit_type: "clinic", date: shiftDays(t, -4), time: "09:30", physiotherapist: "Dr. Sunil Kumar", status: "completed", notes: "Stair negotiation & strengthening", created_at: now, updated_at: now },
    { id: 14, patient_id: 2, visit_type: "clinic", date: shiftDays(t, -7), time: "18:00", physiotherapist: "Dr. Kavitha Nair", status: "completed", notes: "ACL protocol Week 6", created_at: now, updated_at: now },
    { id: 15, patient_id: 3, visit_type: "clinic", date: shiftDays(t, -2), time: "11:00", physiotherapist: "Dr. Sunil Kumar", status: "completed", notes: "Knee OA quad & hip control", created_at: now, updated_at: now },
    { id: 16, patient_id: 5, visit_type: "home", date: shiftDays(t, -3), time: "16:00", physiotherapist: "Dr. Sunil Kumar", status: "completed", notes: "Post-fracture home rehab", created_at: now, updated_at: now },
  ];

  // Build historical + current month + today's invoices & payments
  const invoices: DemoInvoice[] = [];
  const invoiceItems: DemoInvoiceItem[] = [];
  const payments: DemoPayment[] = [];
  let invId = 1;
  let itemId = 1;
  let payId = 1;
  const counters: Record<string, number> = { "seq:patient": 10 };

  const addSeedInvoice = (opts: {
    patientId: number;
    date: string;
    lines: LineInput[];
    notes?: string;
    payments?: { amount: number; method: string; ref?: string; date: string }[];
  }) => {
    const fy = financialYear(opts.date);
    const invKey = `seq:invoice:${fy}`;
    counters[invKey] = (counters[invKey] ?? 0) + 1;
    const invoiceNo = formatDocNumber("NPC", fy, counters[invKey], 4);
    const calc = calcInvoice(opts.lines);
    const paid = (opts.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const id = invId++;

    invoices.push({
      id,
      invoice_no: invoiceNo,
      patient_id: opts.patientId,
      invoice_date: opts.date,
      subtotal: calc.subtotal,
      discount_total: calc.discountTotal,
      tax_total: calc.taxTotal,
      total: calc.total,
      paid,
      status: paymentStatus(calc.total, paid),
      notes: opts.notes ?? null,
      void_reason: null,
      created_by: 1,
      created_at: opts.date + "T10:30:00Z",
      updated_at: opts.date + "T10:30:00Z",
    });

    calc.lines.forEach((l, pos) => {
      invoiceItems.push({
        id: itemId++,
        invoice_id: id,
        position: pos,
        service_id: l.serviceId ?? null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        discount: l.discount,
        tax_rate_bp: l.taxRateBp,
        tax: l.tax,
        total: l.total,
      });
    });

    for (const p of opts.payments ?? []) {
      const pFy = financialYear(p.date);
      const pKey = `seq:receipt:${pFy}`;
      counters[pKey] = (counters[pKey] ?? 0) + 1;
      payments.push({
        id: payId++,
        receipt_no: formatDocNumber("RCPT", pFy, counters[pKey], 4),
        invoice_id: id,
        amount: p.amount,
        method: p.method,
        reference: p.ref ?? null,
        paid_on: p.date,
        received_by: 3,
        created_at: p.date + "T11:00:00Z",
      });
    }
  };

  // Seed prior 11 months so the 12-month dashboard chart looks realistic & organic
  const [curY, curM] = t.split("-").map(Number);
  const monthlyVolumes = [58, 64, 71, 68, 79, 86, 82, 94, 102, 108, 118]; // in ₹ thousands approx
  for (let i = 11; i >= 1; i--) {
    const d1 = new Date(Date.UTC(curY, curM - 1 - i, 8)).toISOString().slice(0, 10);
    const d2 = new Date(Date.UTC(curY, curM - 1 - i, 21)).toISOString().slice(0, 10);
    const vol = monthlyVolumes[11 - i];
    const sessionsA = Math.max(4, Math.round((vol * 1000 * 0.55) / 7800));
    const sessionsB = Math.max(4, Math.round((vol * 1000 * 0.45) / 1100));
    const amtA = sessionsA * 780000;
    const amtB = sessionsB * 110000;
    addSeedInvoice({
      patientId: ((11 - i) % 8) + 1,
      date: d1,
      lines: [{ serviceId: 10, description: "10-Session Post-Surgical Rehab Package", quantity: sessionsA, unitPrice: 780000, discount: 0, taxRateBp: 0 }],
      payments: [{ amount: amtA, method: i % 2 === 0 ? "UPI" : "Card", ref: `UTR6089${10 + i}`, date: d1 }],
    });
    addSeedInvoice({
      patientId: ((13 - i) % 9) + 1,
      date: d2,
      lines: [{ serviceId: 8, description: "Home Visit Physiotherapy (JP Nagar & nearby)", quantity: sessionsB, unitPrice: 110000, discount: 0, taxRateBp: 0 }],
      payments: [{ amount: amtB, method: i % 3 === 0 ? "Cash" : "UPI", ref: i % 3 === 0 ? undefined : `UPI9140${20 + i}`, date: d2 }],
    });
  }

  // Current month & recent realistic clinical invoices (paid, partial, and unpaid)
  addSeedInvoice({
    patientId: 1,
    date: shiftDays(t, -18),
    notes: "Post-Total Knee Replacement (Right) — Initial consultation + 10-session rehabilitation package.",
    lines: [
      { serviceId: 1, description: "Physiotherapy Consultation & Assessment", quantity: 1, unitPrice: 60000, discount: 0, taxRateBp: 0 },
      { serviceId: 10, description: "10-Session Post-Surgical Rehab Package", quantity: 1, unitPrice: 780000, discount: 40000, taxRateBp: 0 },
    ],
    payments: [
      { amount: 400000, method: "UPI", ref: "UPI-439180221", date: shiftDays(t, -18) },
      { amount: 160000, method: "UPI", ref: "UPI-448902114", date: t }, // ₹1,600 collected today! Balance ₹2,400
    ],
  });

  addSeedInvoice({
    patientId: 2,
    date: shiftDays(t, -12),
    notes: "Post-ACL Reconstruction Rehabilitation — 6-session supervised gym & neuromuscular package.",
    lines: [{ serviceId: 9, description: "6-Session Rehabilitation Package", quantity: 1, unitPrice: 390000, discount: 0, taxRateBp: 0 }],
    payments: [{ amount: 390000, method: "Card", ref: "POS-8829", date: shiftDays(t, -12) }],
  });

  addSeedInvoice({
    patientId: 7,
    date: shiftDays(t, -22),
    notes: "Right Shoulder Adhesive Capsulitis — 4 manual & mobility sessions.",
    lines: [{ serviceId: 7, description: "Shoulder Pain Rehabilitation Session", quantity: 4, unitPrice: 75000, discount: 20000, taxRateBp: 0 }],
    payments: [{ amount: 140000, method: "Cash", date: shiftDays(t, -22) }], // ₹1,400 outstanding (0-30 bucket)
  });

  addSeedInvoice({
    patientId: 9,
    date: shiftDays(t, -38),
    notes: "Post-Arthroscopic Meniscectomy — 2 follow-up strengthening sessions.",
    lines: [{ serviceId: 3, description: "Post-Surgical / Joint Replacement Rehab Session", quantity: 2, unitPrice: 85000, discount: 0, taxRateBp: 0 }],
    payments: [], // ₹1,700 unpaid (31-60 days bucket)
  });

  addSeedInvoice({
    patientId: 3,
    date: shiftDays(t, -5),
    notes: "Bilateral Knee Osteoarthritis — Consultation & 4 joint mobility sessions.",
    lines: [
      { serviceId: 1, description: "Physiotherapy Consultation & Assessment", quantity: 1, unitPrice: 60000, discount: 0, taxRateBp: 0 },
      { serviceId: 4, description: "Knee Osteoarthritis & Joint Mobility Session", quantity: 4, unitPrice: 70000, discount: 20000, taxRateBp: 0 },
    ],
    payments: [{ amount: 320000, method: "UPI", ref: "UPI-447112098", date: shiftDays(t, -5) }],
  });

  addSeedInvoice({
    patientId: 5,
    date: shiftDays(t, -3),
    notes: "Home Visit Physiotherapy — Post-hip fracture fixation rehabilitation (2 home visits, Royal County JP Nagar).",
    lines: [{ serviceId: 8, description: "Home Visit Physiotherapy (JP Nagar & nearby)", quantity: 2, unitPrice: 110000, discount: 0, taxRateBp: 0 }],
    payments: [], // ₹2,200 unpaid
  });

  addSeedInvoice({
    patientId: 6,
    date: shiftDays(t, -3),
    notes: "Cervical & Lumbar Postural Pain — Consultation + 3 therapy sessions.",
    lines: [
      { serviceId: 1, description: "Physiotherapy Consultation & Assessment", quantity: 1, unitPrice: 60000, discount: 0, taxRateBp: 0 },
      { serviceId: 6, description: "Back & Neck Pain Manual + Exercise Therapy", quantity: 3, unitPrice: 75000, discount: 15000, taxRateBp: 0 },
    ],
    payments: [{ amount: 270000, method: "Bank transfer", ref: "IMPS-901277", date: shiftDays(t, -2) }],
  });

  // Today's billed & collected invoices so "Today's collections" and "Recent transactions" are immediately vibrant!
  addSeedInvoice({
    patientId: 4,
    date: t,
    notes: "Sports Injury Rehabilitation — Consultation + 3 ankle/knee stability sessions.",
    lines: [
      { serviceId: 1, description: "Physiotherapy Consultation & Assessment", quantity: 1, unitPrice: 60000, discount: 0, taxRateBp: 0 },
      { serviceId: 5, description: "Sports Injury Rehabilitation Session", quantity: 3, unitPrice: 80000, discount: 20000, taxRateBp: 0 },
    ],
    payments: [{ amount: 280000, method: "UPI", ref: "UPI-449001852", date: t }],
  });

  addSeedInvoice({
    patientId: 8,
    date: t,
    notes: "Meniscus Tear Rehabilitation — Follow-up session.",
    lines: [{ serviceId: 2, description: "Standard Physiotherapy Session (Clinic)", quantity: 1, unitPrice: 70000, discount: 0, taxRateBp: 0 }],
    payments: [{ amount: 70000, method: "Cash", date: t }],
  });

  addSeedInvoice({
    patientId: 10,
    date: t,
    notes: "Home Visit Physiotherapy — Knee arthritis & mobility session (Kothnur Dinne).",
    lines: [{ serviceId: 8, description: "Home Visit Physiotherapy (JP Nagar & nearby)", quantity: 1, unitPrice: 110000, discount: 0, taxRateBp: 0 }],
    payments: [], // ₹1,100 unpaid today
  });

  const lastInv = invoices[invoices.length - 1];
  const audit: DemoAudit[] = [
    { id: 1, at: now, username: "dr.sunil", action: "demo.initialised", entity: "system", entity_id: null, details: "Loaded isolated fictional demo dataset" },
    { id: 2, at: t + "T10:45:00Z", username: "reception", action: "payment.create", entity: "invoice", entity_id: String(lastInv.id - 1), details: JSON.stringify({ amount: 70000, method: "Cash" }) },
    { id: 3, at: t + "T10:15:00Z", username: "dr.sunil", action: "invoice.create", entity: "invoice", entity_id: String(lastInv.id - 2), details: JSON.stringify({ total: 280000 }) },
    { id: 4, at: t + "T09:55:00Z", username: "dr.sunil", action: "clinical.create", entity: "patient", entity_id: "1", details: null },
  ];

  const backups: DemoBackupFile[] = [
    {
      file: "E:\\NammaPhysioBackups\\namma-physio-backup-scheduled.npcbak",
      name: "namma-physio-backup-scheduled.npcbak",
      destination: "E:\\NammaPhysioBackups",
      size: 184_320,
      createdAt: shiftDays(t, -1) + "T14:30:00Z",
      encrypted: true,
      kind: "scheduled",
    },
    {
      file: "C:\\Users\\Clinic\\AppData\\Roaming\\Namma Physio Billing\\data\\backups\\namma-physio-backup-manual.npcbak",
      name: "namma-physio-backup-manual.npcbak",
      destination: "C:\\Users\\Clinic\\AppData\\Roaming\\Namma Physio Billing\\data\\backups",
      size: 186_880,
      createdAt: now,
      encrypted: true,
      kind: "manual",
    },
  ];

  const seedFy = financialYear(t);
  const seedDbKey = `seq:detailed_bill:${seedFy}`;
  counters[seedDbKey] = 1;
  const seedBillNo = formatDocNumber(settings.invoice.detailedBillPrefix ?? "NPC-DB", seedFy, 1, settings.invoice.padding);
  const seedSessionDates = [
    shiftDays(t, -18),
    shiftDays(t, -16),
    shiftDays(t, -14),
    shiftDays(t, -11),
    shiftDays(t, -9),
    shiftDays(t, -7),
    shiftDays(t, -4),
    shiftDays(t, -2),
    t,
  ];
  const seedCalc = calcDetailedBill(
    seedSessionDates.map((d) => ({ sessionDate: d, particulars: "Physiotherapy Charges", amount: 120_000 })),
    { treatmentStartDate: seedSessionDates[0], treatmentEndDate: t },
  );
  const detailedBills: DemoDetailedBillRow[] = [
    {
      id: 1,
      bill_no: seedBillNo,
      version: 1,
      parent_bill_id: null,
      superseded_by_id: null,
      patient_id: 1,
      patient_name: "Raghavendra Rao",
      patient_age_gender: "64 and Male",
      referred_by: "Dr. Mahesh Hegde (Orthopaedics)",
      treatment_start_date: seedSessionDates[0],
      treatment_end_date: t,
      bill_date: t,
      default_charge: 120_000,
      total_sessions: seedCalc.totalSessions,
      total_amount: seedCalc.totalAmount,
      amount_in_words: seedCalc.amountInWords,
      status: "ready_for_signature",
      signed_at: null,
      shared_at: null,
      notes: "Fictional sample insurance reimbursement statement.",
      created_by: 1,
      created_at: now,
      updated_at: now,
    },
  ];
  const detailedBillSessions: DemoDetailedSessionRow[] = seedCalc.sessions.map((s, idx) => ({
    id: idx + 1,
    detailed_bill_id: 1,
    sl_no: s.slNo,
    session_date: s.sessionDate,
    day_name: s.dayName,
    particulars: s.particulars,
    amount: s.amount,
    source_appointment_id: s.sourceAppointmentId,
  }));

  return {
    seedDate: t,
    activeUserId: 1,
    settings,
    counters,
    users,
    patients,
    clinicalNotes,
    services,
    invoices,
    invoiceItems,
    payments,
    appointments,
    savedSignatures: [],
    docSignatures: [],
    detailedBills,
    detailedBillSessions,
    audit,
    backups,
  };
}

let memState: DemoState | null = null;

function loadState(): DemoState {
  if (memState) return memState;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      // Re-seed automatically if opened on a new calendar day so "Today" stats stay fresh
      if (parsed && parsed.seedDate === todayIST()) {
        memState = parsed;
        return memState;
      }
    }
  } catch {
    // ignore storage restrictions
  }
  memState = buildSeedState();
  saveState(memState);
  return memState;
}

function saveState(st: DemoState) {
  memState = st;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  } catch {
    // ignore quota/private mode errors
  }
}

export function resetDemoState(): SessionUser {
  const fresh = buildSeedState();
  saveState(fresh);
  return toSessionUser(fresh.users[0]);
}

function toSessionUser(u: DemoUser): SessionUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    mustChangePassword: !!u.must_change_password,
  };
}

function currentUser(st: DemoState): DemoUser {
  const u = st.users.find((x) => x.id === st.activeUserId && x.active);
  if (!u) throw new DemoApiError(401, "Please sign in");
  return u;
}

function assertPerm(st: DemoState, perm: Permission): DemoUser {
  const u = currentUser(st);
  if (!can(u.role, perm)) throw new DemoApiError(403, "Your role does not have permission for this action");
  return u;
}

function logAudit(st: DemoState, user: DemoUser | null, action: string, entity: string | null = null, entityId: string | number | null = null, details?: unknown) {
  const nextId = st.audit.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  st.audit.unshift({
    id: nextId,
    at: new Date().toISOString(),
    username: user?.username ?? null,
    action,
    entity,
    entity_id: entityId != null ? String(entityId) : null,
    details: details !== undefined ? JSON.stringify(details) : null,
  });
}

function nextDocNo(st: DemoState, kind: "invoice" | "receipt", date: string): string {
  const fy = st.settings.invoice.resetEachFinancialYear ? financialYear(date) : null;
  const prefix = kind === "invoice" ? st.settings.invoice.prefix : st.settings.invoice.receiptPrefix;
  const key = `seq:${kind}:${fy ?? "all"}`;
  for (;;) {
    st.counters[key] = (st.counters[key] ?? 0) + 1;
    const no = formatDocNumber(prefix, fy, st.counters[key], st.settings.invoice.padding);
    const exists = kind === "invoice" ? st.invoices.some((i) => i.invoice_no === no) : st.payments.some((p) => p.receipt_no === no);
    if (!exists) return no;
  }
}

function mapPatient(p: DemoPatient) {
  return {
    id: p.id,
    patientCode: p.patient_code,
    name: p.name,
    phone: p.phone,
    email: p.email,
    gender: p.gender,
    dateOfBirth: p.date_of_birth,
    address: p.address,
    emergencyContact: p.emergency_contact,
    adminNotes: p.admin_notes,
    consentRecordedAt: p.consent_recorded_at,
    anonymisedAt: p.anonymised_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function demoApi<T = unknown>(method: string, rawUrl: string, body?: unknown): Promise<T> {
  const st = loadState();
  const [path, qs = ""] = rawUrl.split("?");
  const query = new URLSearchParams(qs);
  const m = method.toUpperCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = (body ?? {}) as Record<string, any>;

  // ---- Auth & Demo Controls ----
  if (m === "GET" && path === "/auth/status") {
    const u = st.users.find((x) => x.id === st.activeUserId && x.active) ?? null;
    return { needsSetup: false, user: u ? toSessionUser(u) : null, clinicName: st.settings.clinic.name } as T;
  }
  if (m === "POST" && path === "/auth/login") {
    const uname = String(b.username ?? "").trim().toLowerCase();
    const u = st.users.find((x) => x.username.toLowerCase() === uname && x.active) ?? st.users[0];
    st.activeUserId = u.id;
    u.last_login_at = new Date().toISOString();
    logAudit(st, u, "auth.login", "user", u.id);
    saveState(st);
    return { user: toSessionUser(u) } as T;
  }
  if (m === "POST" && path === "/auth/logout") {
    st.activeUserId = null;
    saveState(st);
    return { ok: true } as T;
  }
  if (m === "POST" && path === "/demo/switch-role") {
    const role = String(b.role ?? "admin") as Role;
    const u = st.users.find((x) => x.role === role && x.active) ?? st.users[0];
    st.activeUserId = u.id;
    logAudit(st, u, "demo.switch_role", "user", u.id, { role: u.role });
    saveState(st);
    return { user: toSessionUser(u) } as T;
  }
  if (m === "POST" && path === "/demo/reset") {
    const user = resetDemoState();
    return { user } as T;
  }
  if (m === "POST" && path === "/auth/change-password") {
    const u = currentUser(st);
    u.must_change_password = 0;
    saveState(st);
    return { ok: true } as T;
  }

  // ---- Dashboard ----
  if (m === "GET" && path === "/dashboard") {
    const u = currentUser(st);
    const t = todayIST();
    const monthStart = t.slice(0, 8) + "01";
    const financial = can(u.role, "dashboard.financial");

    const upcomingAppointments = st.appointments
      .filter((a) => a.date >= t && (a.status === "requested" || a.status === "confirmed"))
      .sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time))
      .slice(0, 8)
      .map((a) => {
        const p = st.patients.find((x) => x.id === a.patient_id)!;
        return { id: a.id, date: a.date, time: a.time, visit_type: a.visit_type, status: a.status, physiotherapist: a.physiotherapist, patient_name: p.name, patient_id: p.id };
      });

    const recentInvoices = [...st.invoices]
      .sort((a, c) => c.id - a.id)
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        invoice_no: i.invoice_no,
        invoice_date: i.invoice_date,
        total: i.total,
        paid: i.paid,
        status: i.status,
        patient_name: st.patients.find((x) => x.id === i.patient_id)?.name ?? "Unknown",
      }));

    const todayAppts = st.appointments.filter((a) => a.date === t && ["requested", "confirmed", "completed"].includes(a.status));
    const base = {
      totalPatients: st.patients.filter((p) => !p.anonymised_at).length,
      todayAppointments: todayAppts.length,
      upcomingAppointments,
      recentInvoices,
    };
    if (!financial) return { financial: false, ...base } as T;

    const sumCollected = (from: string, to: string) =>
      st.payments.filter((p) => p.paid_on >= from && p.paid_on <= to).reduce((s, p) => s + p.amount, 0);
    const sumBilled = (from: string, to: string) =>
      st.invoices.filter((i) => i.status !== "void" && i.invoice_date >= from && i.invoice_date <= to).reduce((s, i) => s + i.total, 0);

    const [yy, mm] = t.split("-").map(Number);
    const trend: { month: string; collected: number; billed: number }[] = [];
    for (let idx = 11; idx >= 0; idx--) {
      const d = new Date(Date.UTC(yy, mm - 1 - idx, 1));
      const key = d.toISOString().slice(0, 7);
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      trend.push({ month: key, collected: sumCollected(`${key}-01`, end), billed: sumBilled(`${key}-01`, end) });
    }

    const openInvs = st.invoices.filter((i) => i.status === "unpaid" || i.status === "partial");
    const methodMap = new Map<string, { method: string; total: number; count: number }>();
    for (const p of st.payments.filter((x) => x.paid_on >= monthStart && x.paid_on <= t)) {
      const cur = methodMap.get(p.method) ?? { method: p.method, total: 0, count: 0 };
      cur.total += p.amount;
      cur.count += 1;
      methodMap.set(p.method, cur);
    }

    const recentPayments = [...st.payments]
      .sort((a, c) => c.id - a.id)
      .slice(0, 8)
      .map((p) => {
        const inv = st.invoices.find((i) => i.id === p.invoice_id)!;
        const pat = st.patients.find((x) => x.id === inv.patient_id)!;
        return { id: p.id, receipt_no: p.receipt_no, amount: p.amount, method: p.method, paid_on: p.paid_on, patient_name: pat.name, invoice_id: inv.id };
      });

    return {
      financial: true,
      ...base,
      todayCollected: sumCollected(t, t),
      todayBilled: sumBilled(t, t),
      monthCollected: sumCollected(monthStart, t),
      monthBilled: sumBilled(monthStart, t),
      outstanding: { s: openInvs.reduce((s, i) => s + (i.total - i.paid), 0), c: openInvs.length },
      recentPayments,
      trend,
      methods: [...methodMap.values()].sort((a, c) => c.total - a.total),
    } as T;
  }

  // ---- Patients ----
  if (m === "GET" && path === "/patients") {
    assertPerm(st, "patients.read");
    const q = (query.get("q") ?? "").trim().toLowerCase();
    const limit = Math.min(Number(query.get("limit")) || 50, 500);
    const offset = Math.max(Number(query.get("offset")) || 0, 0);
    const filtered = st.patients
      .filter((p) => !q || [p.name, p.phone, p.patient_code, p.email].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, c) => c.updated_at.localeCompare(a.updated_at));
    const items = filtered.slice(offset, offset + limit).map((p) => {
      const pInvs = st.invoices.filter((i) => i.patient_id === p.id && i.status !== "void");
      const outstanding = pInvs.reduce((s, i) => s + (i.total - i.paid), 0);
      const lastInvoice = pInvs.reduce<string | null>((mx, i) => (!mx || i.invoice_date > mx ? i.invoice_date : mx), null);
      return { ...mapPatient(p), outstanding, lastInvoice };
    });
    return { total: filtered.length, items } as T;
  }

  const patExportMatch = path.match(/^\/patients\/(\d+)\/export$/);
  if (m === "GET" && patExportMatch) {
    const u = assertPerm(st, "patients.delete");
    const pid = Number(patExportMatch[1]);
    const patient = st.patients.find((p) => p.id === pid);
    if (!patient) throw new DemoApiError(404, "Patient not found");
    logAudit(st, u, "patient.export", "patient", pid);
    saveState(st);
    const invIds = new Set(st.invoices.filter((i) => i.patient_id === pid).map((i) => i.id));
    return {
      exportedAt: new Date().toISOString(),
      patient,
      appointments: st.appointments.filter((a) => a.patient_id === pid),
      invoices: st.invoices.filter((i) => i.patient_id === pid),
      invoiceItems: st.invoiceItems.filter((ii) => invIds.has(ii.invoice_id)),
      payments: st.payments.filter((p) => invIds.has(p.invoice_id)),
      clinicalNotes: st.clinicalNotes.filter((n) => n.patient_id === pid),
    } as T;
  }

  const patNotesMatch = path.match(/^\/patients\/(\d+)\/notes$/);
  if (patNotesMatch) {
    const pid = Number(patNotesMatch[1]);
    if (m === "GET") {
      const u = assertPerm(st, "clinical.read");
      logAudit(st, u, "clinical.view", "patient", pid);
      saveState(st);
      return st.clinicalNotes
        .filter((n) => n.patient_id === pid)
        .sort((a, c) => c.created_at.localeCompare(a.created_at))
        .map((n) => ({
          id: n.id,
          note: n.note,
          created_at: n.created_at,
          author: st.users.find((x) => x.id === n.author_id)?.display_name ?? "Clinician",
        })) as T;
    }
    if (m === "POST") {
      const u = assertPerm(st, "clinical.write");
      const note = String(b.note ?? "").trim();
      if (!note) throw new DemoApiError(400, "Enter a clinical note");
      const id = st.clinicalNotes.reduce((mx, n) => Math.max(mx, n.id), 0) + 1;
      st.clinicalNotes.push({ id, patient_id: pid, author_id: u.id, note, created_at: new Date().toISOString() });
      logAudit(st, u, "clinical.create", "patient", pid);
      saveState(st);
      return { id } as T;
    }
  }

  const patIdMatch = path.match(/^\/patients\/(\d+)$/);
  if (patIdMatch) {
    const pid = Number(patIdMatch[1]);
    const p = st.patients.find((x) => x.id === pid);
    if (!p) throw new DemoApiError(404, "Patient not found");
    if (m === "GET") {
      assertPerm(st, "patients.read");
      const invoices = st.invoices
        .filter((i) => i.patient_id === pid)
        .sort((a, c) => c.invoice_date.localeCompare(a.invoice_date) || c.id - a.id)
        .map((i) => ({ id: i.id, invoice_no: i.invoice_no, invoice_date: i.invoice_date, total: i.total, paid: i.paid, status: i.status }));
      const invMap = new Map(st.invoices.filter((i) => i.patient_id === pid).map((i) => [i.id, i]));
      const payments = st.payments
        .filter((pay) => invMap.has(pay.invoice_id))
        .sort((a, c) => c.paid_on.localeCompare(a.paid_on) || c.id - a.id)
        .map((pay) => ({ id: pay.id, receipt_no: pay.receipt_no, amount: pay.amount, method: pay.method, paid_on: pay.paid_on, invoice_no: invMap.get(pay.invoice_id)!.invoice_no }));
      const appointments = st.appointments
        .filter((a) => a.patient_id === pid)
        .sort((a, c) => (c.date + c.time).localeCompare(a.date + a.time));
      const validInvs = st.invoices.filter((i) => i.patient_id === pid && i.status !== "void");
      const billed = validInvs.reduce((s, i) => s + i.total, 0);
      const paid = validInvs.reduce((s, i) => s + i.paid, 0);
      return { patient: mapPatient(p), invoices, payments, appointments, totals: { billed, paid, outstanding: billed - paid } } as T;
    }
    if (m === "PUT") {
      const u = assertPerm(st, "patients.write");
      if (p.anonymised_at) throw new DemoApiError(409, "This patient record has been anonymised and cannot be edited");
      const name = String(b.name ?? "").trim();
      if (name.length < 2) throw new DemoApiError(400, "Enter the patient's name");
      const now = new Date().toISOString();
      Object.assign(p, {
        name,
        phone: b.phone?.trim() || null,
        email: b.email?.trim() || null,
        gender: b.gender?.trim() || null,
        date_of_birth: b.dateOfBirth || null,
        address: b.address?.trim() || null,
        emergency_contact: b.emergencyContact?.trim() || null,
        admin_notes: b.adminNotes?.trim() || null,
        consent_recorded_at: b.consentRecorded ? p.consent_recorded_at ?? now : null,
        updated_at: now,
      });
      logAudit(st, u, "patient.update", "patient", pid);
      saveState(st);
      return { ok: true } as T;
    }
    if (m === "DELETE") {
      const u = assertPerm(st, "patients.delete");
      const reason = String(b.reason ?? "").trim();
      if (reason.length < 5) throw new DemoApiError(400, "Record the reason for deletion");
      const hasInvoices = st.invoices.some((i) => i.patient_id === pid);
      const now = new Date().toISOString();
      if (hasInvoices) {
        st.clinicalNotes = st.clinicalNotes.filter((n) => n.patient_id !== pid);
        Object.assign(p, {
          name: `Anonymised patient ${p.patient_code}`,
          phone: null, email: null, gender: null, date_of_birth: null, address: null, emergency_contact: null, admin_notes: null,
          anonymised_at: now, updated_at: now,
        });
      } else {
        st.patients = st.patients.filter((x) => x.id !== pid);
        st.appointments = st.appointments.filter((a) => a.patient_id !== pid);
        st.clinicalNotes = st.clinicalNotes.filter((n) => n.patient_id !== pid);
      }
      logAudit(st, u, hasInvoices ? "patient.anonymise" : "patient.delete", "patient", pid, { reason });
      saveState(st);
      return { ok: true, mode: hasInvoices ? "anonymised" : "deleted" } as T;
    }
  }

  if (m === "POST" && path === "/patients") {
    const u = assertPerm(st, "patients.write");
    const name = String(b.name ?? "").trim();
    if (name.length < 2) throw new DemoApiError(400, "Enter the patient's name");
    st.counters["seq:patient"] = (st.counters["seq:patient"] ?? 10) + 1;
    const code = `NPC-P-${String(st.counters["seq:patient"]).padStart(5, "0")}`;
    const id = st.patients.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
    const now = new Date().toISOString();
    st.patients.push({
      id,
      patient_code: code,
      name,
      phone: b.phone?.trim() || null,
      email: b.email?.trim() || null,
      gender: b.gender?.trim() || null,
      date_of_birth: b.dateOfBirth || null,
      address: b.address?.trim() || null,
      emergency_contact: b.emergencyContact?.trim() || null,
      admin_notes: b.adminNotes?.trim() || null,
      consent_recorded_at: b.consentRecorded ? now : null,
      anonymised_at: null,
      created_at: now,
      updated_at: now,
    });
    logAudit(st, u, "patient.create", "patient", id, { code });
    saveState(st);
    return { id, code } as T;
  }

  // ---- Services ----
  if (m === "GET" && path === "/services") {
    assertPerm(st, "invoices.read");
    return [...st.services].sort((a, c) => c.active - a.active || a.name.localeCompare(c.name)) as T;
  }
  if (m === "POST" && path === "/services") {
    const u = assertPerm(st, "settings.write");
    const id = st.services.reduce((mx, s) => Math.max(mx, s.id), 0) + 1;
    st.services.push({ id, name: String(b.name).trim(), default_price: Number(b.defaultPrice) || 0, taxable: b.taxable ? 1 : 0, active: b.active ? 1 : 0 });
    logAudit(st, u, "service.create", "service", id);
    saveState(st);
    return { id } as T;
  }
  const svcMatch = path.match(/^\/services\/(\d+)$/);
  if (m === "PUT" && svcMatch) {
    const u = assertPerm(st, "settings.write");
    const s = st.services.find((x) => x.id === Number(svcMatch[1]));
    if (!s) throw new DemoApiError(404, "Service not found");
    Object.assign(s, { name: String(b.name).trim(), default_price: Number(b.defaultPrice) || 0, taxable: b.taxable ? 1 : 0, active: b.active ? 1 : 0 });
    logAudit(st, u, "service.update", "service", s.id);
    saveState(st);
    return { ok: true } as T;
  }

  // ---- Invoices & Payments ----
  if (m === "GET" && path === "/invoices") {
    assertPerm(st, "invoices.read");
    const q = (query.get("q") ?? "").trim().toLowerCase();
    const status = query.get("status") ?? "";
    const from = query.get("from") ?? "";
    const to = query.get("to") ?? "";
    const limit = Math.min(Number(query.get("limit")) || 50, 500);
    const offset = Math.max(Number(query.get("offset")) || 0, 0);

    const filtered = st.invoices
      .filter((i) => {
        const p = st.patients.find((x) => x.id === i.patient_id);
        if (q && ![i.invoice_no, p?.name, p?.patient_code, p?.phone].some((v) => v?.toLowerCase().includes(q))) return false;
        if (["unpaid", "partial", "paid", "void"].includes(status) && i.status !== status) return false;
        if (status === "outstanding" && !["unpaid", "partial"].includes(i.status)) return false;
        if (from && i.invoice_date < from) return false;
        if (to && i.invoice_date > to) return false;
        return true;
      })
      .sort((a, c) => c.invoice_date.localeCompare(a.invoice_date) || c.id - a.id);

    const items = filtered.slice(offset, offset + limit).map((i) => {
      const p = st.patients.find((x) => x.id === i.patient_id)!;
      return {
        id: i.id, invoice_no: i.invoice_no, invoice_date: i.invoice_date, total: i.total, paid: i.paid, status: i.status,
        patient_name: p.name, patient_code: p.patient_code, patient_id: p.id,
      };
    });
    return { total: filtered.length, items } as T;
  }

  const invVoidMatch = path.match(/^\/invoices\/(\d+)\/void$/);
  if (m === "POST" && invVoidMatch) {
    const u = assertPerm(st, "invoices.void");
    const inv = st.invoices.find((x) => x.id === Number(invVoidMatch[1]));
    if (!inv) throw new DemoApiError(404, "Invoice not found");
    if (inv.status === "void") throw new DemoApiError(409, "Invoice is already void");
    const reason = String(b.reason ?? "").trim();
    if (reason.length < 5) throw new DemoApiError(400, "Give a reason (at least 5 characters)");
    inv.status = "void";
    inv.void_reason = reason;
    inv.updated_at = new Date().toISOString();
    logAudit(st, u, "invoice.void", "invoice", inv.id, { invoiceNo: inv.invoice_no, reason });
    saveState(st);
    return { ok: true } as T;
  }

  const invPayMatch = path.match(/^\/invoices\/(\d+)\/payments$/);
  if (m === "POST" && invPayMatch) {
    const u = assertPerm(st, "payments.write");
    const inv = st.invoices.find((x) => x.id === Number(invPayMatch[1]));
    if (!inv) throw new DemoApiError(404, "Invoice not found");
    if (inv.status === "void") throw new DemoApiError(409, "Cannot record a payment on a void invoice");
    const amount = Number(b.amount) || 0;
    if (amount <= 0) throw new DemoApiError(400, "Enter a valid payment amount");
    if (amount > inv.total - inv.paid) throw new DemoApiError(400, "Payment is more than the outstanding balance");
    const paidOn = String(b.paidOn || todayIST());
    const receiptNo = nextDocNo(st, "receipt", paidOn);
    const id = st.payments.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
    st.payments.push({
      id, receipt_no: receiptNo, invoice_id: inv.id, amount, method: String(b.method || "UPI"),
      reference: b.reference?.trim() || null, paid_on: paidOn, received_by: u.id, created_at: new Date().toISOString(),
    });
    inv.paid += amount;
    inv.status = paymentStatus(inv.total, inv.paid, false);
    inv.updated_at = new Date().toISOString();
    logAudit(st, u, "payment.create", "invoice", inv.id, { receiptNo, amount, method: b.method });
    saveState(st);
    return { id, receiptNo } as T;
  }

  const invIdMatch = path.match(/^\/invoices\/(\d+)$/);
  if (invIdMatch) {
    const iid = Number(invIdMatch[1]);
    const inv = st.invoices.find((x) => x.id === iid);
    if (!inv) throw new DemoApiError(404, "Invoice not found");
    if (m === "GET") {
      assertPerm(st, "invoices.read");
      const p = st.patients.find((x) => x.id === inv.patient_id)!;
      const creator = st.users.find((x) => x.id === inv.created_by);
      const items = st.invoiceItems.filter((x) => x.invoice_id === iid).sort((a, c) => a.position - c.position);
      const payments = st.payments
        .filter((x) => x.invoice_id === iid)
        .sort((a, c) => a.paid_on.localeCompare(c.paid_on) || a.id - c.id)
        .map((pay) => ({ ...pay, received_by_name: st.users.find((u) => u.id === pay.received_by)?.display_name ?? null }));
      return {
        invoice: {
          ...inv,
          patient_name: p.name,
          patient_code: p.patient_code,
          patient_phone: p.phone,
          patient_address: p.address,
          patient_email: p.email,
          created_by_name: creator?.display_name ?? null,
        },
        items,
        payments,
      } as T;
    }
    if (m === "PUT") {
      const u = assertPerm(st, "invoices.write");
      if (inv.status === "void" || inv.paid > 0) throw new DemoApiError(409, "Paid or void invoices cannot be edited");
      if (st.docSignatures.some((s) => s.docType === "invoice" && s.docId === iid)) {
        throw new DemoApiError(409, "Signed invoices are locked against silent modification. Void and reissue if required.");
      }
      const taxOn = st.settings.tax.enabled;
      const calc = calcInvoice((b.items as LineInput[]).map((l) => ({ ...l, taxRateBp: taxOn ? l.taxRateBp : 0 })));
      Object.assign(inv, {
        patient_id: Number(b.patientId),
        invoice_date: String(b.invoiceDate),
        subtotal: calc.subtotal,
        discount_total: calc.discountTotal,
        tax_total: calc.taxTotal,
        total: calc.total,
        status: paymentStatus(calc.total, 0),
        notes: b.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      });
      st.invoiceItems = st.invoiceItems.filter((x) => x.invoice_id !== iid);
      let nextItemId = st.invoiceItems.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
      calc.lines.forEach((l, pos) => {
        st.invoiceItems.push({
          id: nextItemId++, invoice_id: iid, position: pos, service_id: l.serviceId ?? null, description: l.description,
          quantity: l.quantity, unit_price: l.unitPrice, discount: l.discount, tax_rate_bp: l.taxRateBp, tax: l.tax, total: l.total,
        });
      });
      logAudit(st, u, "invoice.update", "invoice", iid, { invoiceNo: inv.invoice_no, total: calc.total });
      saveState(st);
      return { ok: true } as T;
    }
  }

  if (m === "POST" && path === "/invoices") {
    const u = assertPerm(st, "invoices.write");
    const p = st.patients.find((x) => x.id === Number(b.patientId));
    if (!p) throw new DemoApiError(400, "Choose a patient");
    if (p.anonymised_at) throw new DemoApiError(409, "Cannot bill an anonymised patient record");
    const taxOn = st.settings.tax.enabled;
    const calc = calcInvoice((b.items as LineInput[]).map((l) => ({ ...l, taxRateBp: taxOn ? l.taxRateBp : 0 })));
    const invoiceDate = String(b.invoiceDate || todayIST());
    const invoiceNo = nextDocNo(st, "invoice", invoiceDate);
    const id = st.invoices.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
    const now = new Date().toISOString();

    let paid = 0;
    let receipt: { id: number; receiptNo: string } | null = null;
    if (b.payment && Number(b.payment.amount) > 0) {
      if (!can(u.role, "payments.write")) throw new DemoApiError(403, "You don't have permission to record payments");
      const amt = Number(b.payment.amount);
      if (amt > calc.total) throw new DemoApiError(400, "Payment is more than the invoice total");
      paid = amt;
      const paidOn = String(b.payment.paidOn || invoiceDate);
      const receiptNo = nextDocNo(st, "receipt", paidOn);
      const pid = st.payments.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
      st.payments.push({
        id: pid, receipt_no: receiptNo, invoice_id: id, amount: amt, method: String(b.payment.method || "UPI"),
        reference: b.payment.reference?.trim() || null, paid_on: paidOn, received_by: u.id, created_at: now,
      });
      receipt = { id: pid, receiptNo };
    }

    st.invoices.push({
      id, invoice_no: invoiceNo, patient_id: p.id, invoice_date: invoiceDate,
      subtotal: calc.subtotal, discount_total: calc.discountTotal, tax_total: calc.taxTotal, total: calc.total,
      paid, status: paymentStatus(calc.total, paid), notes: b.notes?.trim() || null, void_reason: null,
      created_by: u.id, created_at: now, updated_at: now,
    });
    let nextItemId = st.invoiceItems.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
    calc.lines.forEach((l, pos) => {
      st.invoiceItems.push({
        id: nextItemId++, invoice_id: id, position: pos, service_id: l.serviceId ?? null, description: l.description,
        quantity: l.quantity, unit_price: l.unitPrice, discount: l.discount, tax_rate_bp: l.taxRateBp, tax: l.tax, total: l.total,
      });
    });
    p.updated_at = now;
    logAudit(st, u, "invoice.create", "invoice", id, { invoiceNo, total: calc.total });
    saveState(st);
    return { id, invoiceNo, receipt } as T;
  }

  const payIdMatch = path.match(/^\/payments\/(\d+)$/);
  if (payIdMatch) {
    const payId = Number(payIdMatch[1]);
    const pay = st.payments.find((x) => x.id === payId);
    if (!pay) throw new DemoApiError(404, "Payment not found");
    if (m === "GET") {
      assertPerm(st, "invoices.read");
      const inv = st.invoices.find((x) => x.id === pay.invoice_id)!;
      const pat = st.patients.find((x) => x.id === inv.patient_id)!;
      return {
        ...pay,
        invoice_no: inv.invoice_no,
        invoice_total: inv.total,
        invoice_paid: inv.paid,
        invoice_date: inv.invoice_date,
        patient_name: pat.name,
        patient_code: pat.patient_code,
        patient_phone: pat.phone,
        received_by_name: st.users.find((u) => u.id === pay.received_by)?.display_name ?? null,
      } as T;
    }
    if (m === "DELETE") {
      const u = assertPerm(st, "invoices.void");
      st.payments = st.payments.filter((x) => x.id !== payId);
      const inv = st.invoices.find((x) => x.id === pay.invoice_id)!;
      inv.paid = st.payments.filter((x) => x.invoice_id === inv.id).reduce((s, x) => s + x.amount, 0);
      inv.status = paymentStatus(inv.total, inv.paid, inv.status === "void");
      logAudit(st, u, "payment.delete", "payment", payId, { receiptNo: pay.receipt_no, reason: b.reason });
      saveState(st);
      return { ok: true } as T;
    }
  }

  // ---- Appointments ----
  if (m === "GET" && path === "/appointments") {
    assertPerm(st, "appointments.read");
    const from = query.get("from") || todayIST();
    const to = query.get("to") || "9999-12-31";
    const status = query.get("status") || "";
    return st.appointments
      .filter((a) => a.date >= from && a.date <= to && (!status || a.status === status))
      .sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time))
      .map((a) => {
        const p = st.patients.find((x) => x.id === a.patient_id)!;
        return { ...a, patient_name: p.name, patient_code: p.patient_code, patient_phone: p.phone };
      }) as T;
  }
  if (m === "POST" && path === "/appointments") {
    const u = assertPerm(st, "appointments.write");
    const clash = st.appointments.some(
      (a) =>
        a.date === b.date &&
        a.time === b.time &&
        (a.status === "requested" || a.status === "confirmed") &&
        (a.physiotherapist ?? "") === (b.physiotherapist ?? ""),
    );
    if (clash && !query.get("force")) throw new DemoApiError(409, "Another appointment is already booked at this time for the same physiotherapist");
    const id = st.appointments.reduce((mx, a) => Math.max(mx, a.id), 0) + 1;
    const now = new Date().toISOString();
    st.appointments.push({
      id, patient_id: Number(b.patientId), visit_type: b.visitType, date: b.date, time: b.time,
      physiotherapist: b.physiotherapist || null, status: b.status, notes: b.notes?.trim() || null, created_at: now, updated_at: now,
    });
    logAudit(st, u, "appointment.create", "appointment", id);
    saveState(st);
    return { id } as T;
  }
  const apptMatch = path.match(/^\/appointments\/(\d+)$/);
  if (apptMatch) {
    const u = assertPerm(st, "appointments.write");
    const aid = Number(apptMatch[1]);
    if (m === "PUT") {
      const a = st.appointments.find((x) => x.id === aid);
      if (!a) throw new DemoApiError(404, "Appointment not found");
      Object.assign(a, {
        patient_id: Number(b.patientId), visit_type: b.visitType, date: b.date, time: b.time,
        physiotherapist: b.physiotherapist || null, status: b.status, notes: b.notes?.trim() || null, updated_at: new Date().toISOString(),
      });
      logAudit(st, u, "appointment.update", "appointment", aid, { status: b.status });
      saveState(st);
      return { ok: true } as T;
    }
    if (m === "DELETE") {
      st.appointments = st.appointments.filter((x) => x.id !== aid);
      logAudit(st, u, "appointment.delete", "appointment", aid);
      saveState(st);
      return { ok: true } as T;
    }
  }

  // ---- Reports ----
  if (path.startsWith("/reports/")) {
    assertPerm(st, "reports.read");
    const t = todayIST();
    const to = query.get("to") || t;
    const from = query.get("from") || shiftDays(to, -29);

    if (path === "/reports/revenue") {
      const group = (query.get("group") || "day") as "day" | "week" | "month";
      const keyFn = (iso: string) => (group === "month" ? iso.slice(0, 7) : group === "week" ? isoWeekKey(iso) : iso);
      const map = new Map<string, { period: string; invoices: number; billed: number; discounts: number; tax: number; payments: number; collected: number }>();
      const getRow = (k: string) => {
        let r = map.get(k);
        if (!r) {
          r = { period: k, invoices: 0, billed: 0, discounts: 0, tax: 0, payments: 0, collected: 0 };
          map.set(k, r);
        }
        return r;
      };
      for (const i of st.invoices.filter((x) => x.status !== "void" && x.invoice_date >= from && x.invoice_date <= to)) {
        const r = getRow(keyFn(i.invoice_date));
        r.invoices += 1;
        r.billed += i.total;
        r.discounts += i.discount_total;
        r.tax += i.tax_total;
      }
      for (const p of st.payments.filter((x) => x.paid_on >= from && x.paid_on <= to)) {
        const r = getRow(keyFn(p.paid_on));
        r.payments += 1;
        r.collected += p.amount;
      }
      const rows = [...map.values()].sort((a, c) => a.period.localeCompare(c.period));
      const totals = rows.reduce(
        (acc, r) => ({
          invoices: acc.invoices + r.invoices, billed: acc.billed + r.billed, discounts: acc.discounts + r.discounts,
          tax: acc.tax + r.tax, payments: acc.payments + r.payments, collected: acc.collected + r.collected,
        }),
        { invoices: 0, billed: 0, discounts: 0, tax: 0, payments: 0, collected: 0 },
      );
      return { from, to, group, rows, totals } as T;
    }

    if (path === "/reports/outstanding") {
      const rows = st.invoices
        .filter((i) => i.status === "unpaid" || i.status === "partial")
        .sort((a, c) => a.invoice_date.localeCompare(c.invoice_date))
        .map((i) => {
          const p = st.patients.find((x) => x.id === i.patient_id)!;
          return {
            id: i.id, invoice_no: i.invoice_no, invoice_date: i.invoice_date, total: i.total, paid: i.paid,
            balance: i.total - i.paid, status: i.status, patient_name: p.name, patient_code: p.patient_code,
            patient_phone: p.phone, age_days: daysBetween(i.invoice_date, t),
          };
        });
      const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
      for (const r of rows) {
        const k = r.age_days <= 30 ? "0-30" : r.age_days <= 60 ? "31-60" : r.age_days <= 90 ? "61-90" : "90+";
        buckets[k] += r.balance;
      }
      return { rows, buckets, total: rows.reduce((s, r) => s + r.balance, 0) } as T;
    }

    if (path === "/reports/services") {
      const validIds = new Set(st.invoices.filter((i) => i.status !== "void" && i.invoice_date >= from && i.invoice_date <= to).map((i) => i.id));
      const map = new Map<string, { service: string; quantity: number; gross: number; discounts: number; tax: number; total: number; invSet: Set<number> }>();
      for (const ii of st.invoiceItems.filter((x) => validIds.has(x.invoice_id))) {
        const name = st.services.find((s) => s.id === ii.service_id)?.name ?? ii.description;
        const cur = map.get(name) ?? { service: name, quantity: 0, gross: 0, discounts: 0, tax: 0, total: 0, invSet: new Set<number>() };
        cur.quantity += ii.quantity;
        cur.gross += ii.quantity * ii.unit_price;
        cur.discounts += ii.discount;
        cur.tax += ii.tax;
        cur.total += ii.total;
        cur.invSet.add(ii.invoice_id);
        map.set(name, cur);
      }
      const rows = [...map.values()]
        .map(({ invSet, ...rest }) => ({ ...rest, invoices: invSet.size }))
        .sort((a, c) => c.total - a.total);
      return { from, to, rows, total: rows.reduce((s, r) => s + r.total, 0) } as T;
    }

    if (path === "/reports/methods") {
      const map = new Map<string, { method: string; total: number; count: number }>();
      for (const p of st.payments.filter((x) => x.paid_on >= from && x.paid_on <= to)) {
        const cur = map.get(p.method) ?? { method: p.method, total: 0, count: 0 };
        cur.total += p.amount;
        cur.count += 1;
        map.set(p.method, cur);
      }
      const rows = [...map.values()].sort((a, c) => c.total - a.total);
      return { from, to, rows, total: rows.reduce((s, r) => s + r.total, 0) } as T;
    }

    if (path === "/reports/payments") {
      const rows = st.payments
        .filter((x) => x.paid_on >= from && x.paid_on <= to)
        .sort((a, c) => c.paid_on.localeCompare(a.paid_on) || c.id - a.id)
        .map((pay) => {
          const inv = st.invoices.find((i) => i.id === pay.invoice_id)!;
          const pat = st.patients.find((p) => p.id === inv.patient_id)!;
          return {
            id: pay.id, receipt_no: pay.receipt_no, paid_on: pay.paid_on, amount: pay.amount, method: pay.method,
            reference: pay.reference, invoice_id: inv.id, invoice_no: inv.invoice_no,
            patient_id: pat.id, patient_name: pat.name, patient_code: pat.patient_code,
          };
        });
      return { from, to, rows, count: rows.length, total: rows.reduce((s, r) => s + r.amount, 0) } as T;
    }

    if (path === "/reports/patients") {
      const map = new Map<number, { id: number; patient_code: string; name: string; invoices: number; billed: number; paid: number; outstanding: number; last_invoice: string }>();
      for (const i of st.invoices.filter((x) => x.status !== "void" && x.invoice_date >= from && x.invoice_date <= to)) {
        const p = st.patients.find((x) => x.id === i.patient_id)!;
        const cur = map.get(p.id) ?? { id: p.id, patient_code: p.patient_code, name: p.name, invoices: 0, billed: 0, paid: 0, outstanding: 0, last_invoice: i.invoice_date };
        cur.invoices += 1;
        cur.billed += i.total;
        cur.paid += i.paid;
        cur.outstanding += i.total - i.paid;
        if (i.invoice_date > cur.last_invoice) cur.last_invoice = i.invoice_date;
        map.set(p.id, cur);
      }
      return { from, to, rows: [...map.values()].sort((a, c) => c.billed - a.billed) } as T;
    }
  }

  // ---- Settings, Staff, Backups & Audit ----
  if (m === "GET" && path === "/settings") {
    currentUser(st);
    return structuredClone(st.settings) as T;
  }
  if (m === "PUT" && path === "/settings") {
    const u = assertPerm(st, "settings.write");
    st.settings = b as Settings;
    logAudit(st, u, "settings.update", "settings", null);
    saveState(st);
    return structuredClone(st.settings) as T;
  }
  if (m === "POST" && path === "/settings/counters") {
    const u = assertPerm(st, "settings.write");
    const key = `seq:${b.kind}:${b.scope}`;
    st.counters[key] = Math.max(0, Number(b.nextNumber) - 1);
    logAudit(st, u, "settings.counter", "settings", key, b);
    saveState(st);
    return { ok: true } as T;
  }

  if (m === "GET" && path === "/users") {
    assertPerm(st, "users.manage");
    return st.users as T;
  }
  if (m === "POST" && path === "/users") {
    const u = assertPerm(st, "users.manage");
    const id = st.users.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
    st.users.push({
      id, username: String(b.username).trim(), display_name: String(b.displayName).trim(),
      role: b.role as Role, active: 1, must_change_password: 1, last_login_at: null,
    });
    logAudit(st, u, "user.create", "user", id, { username: b.username, role: b.role });
    saveState(st);
    return { id } as T;
  }
  const usrMatch = path.match(/^\/users\/(\d+)$/);
  if (m === "PUT" && usrMatch) {
    const u = assertPerm(st, "users.manage");
    const target = st.users.find((x) => x.id === Number(usrMatch[1]));
    if (!target) throw new DemoApiError(404, "User not found");
    Object.assign(target, { display_name: String(b.displayName).trim(), role: b.role as Role, active: b.active ? 1 : 0 });
    logAudit(st, u, "user.update", "user", target.id);
    saveState(st);
    return { ok: true } as T;
  }

  if (m === "GET" && path === "/backups/status") {
    assertPerm(st, "backups.manage");
    const defaultDest = "C:\\Users\\Clinic\\AppData\\Roaming\\Namma Physio Billing\\data\\backups";
    return {
      lastBackupAt: st.backups[st.backups.length - 1]?.createdAt ?? null,
      lastError: null,
      schedule: st.settings.backup.schedule,
      encrypt: st.settings.backup.encrypt,
      passphraseSet: true,
      osProtectedSecrets: true,
      sameDriveOnly: st.settings.backup.destinations.length === 0,
      destinations: [
        { path: defaultDest, isDefault: true, writable: true },
        ...st.settings.backup.destinations.map((d) => ({ path: d, isDefault: false, writable: true })),
      ],
      dbFile: "C:\\Users\\Clinic\\AppData\\Roaming\\Namma Physio Billing\\data\\namma-physio.db",
      log: st.backups.map((bk, idx) => ({ id: idx + 1, at: bk.createdAt, kind: bk.kind, destination: bk.destination, ok: 1, message: null, size: bk.size })),
    } as T;
  }
  if (m === "GET" && path === "/backups") {
    assertPerm(st, "backups.manage");
    return [...st.backups].reverse() as T;
  }
  if (m === "POST" && path === "/backups") {
    const u = assertPerm(st, "backups.manage");
    const now = new Date().toISOString();
    const dests = ["C:\\Users\\Clinic\\AppData\\Roaming\\Namma Physio Billing\\data\\backups", ...st.settings.backup.destinations];
    for (const d of dests) {
      st.backups.push({
        file: `${d}\\namma-physio-${now.slice(0, 10)}.npcbak`,
        name: `namma-physio-${now.slice(0, 10)}.npcbak`,
        destination: d,
        size: 188_416,
        createdAt: now,
        encrypted: st.settings.backup.encrypt,
        kind: "manual",
      });
    }
    logAudit(st, u, "backup.manual", "backup", null);
    saveState(st);
    return { results: dests.map((destination) => ({ destination, ok: true })) } as T;
  }
  if (m === "POST" && path === "/backups/verify") {
    assertPerm(st, "backups.manage");
    return { ok: true, patients: st.patients.length, invoices: st.invoices.length, payments: st.payments.length } as T;
  }
  if (m === "POST" && (path === "/backups/passphrase" || path === "/backups/restore")) {
    assertPerm(st, "backups.manage");
    return { ok: true } as T;
  }

  if (m === "GET" && path === "/inquiries") {
    assertPerm(st, "inquiries.read");
    return {
      items: [],
      total: 0,
      sync: {
        configured: true,
        websiteUrl: "https://namma-physio-centre-psi.vercel.app",
        state: "idle",
        lastSyncAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
        totalInquiries: 0,
      },
    } as T;
  }
  if (m === "GET" && path === "/inquiries/status") {
    assertPerm(st, "inquiries.read");
    return {
      configured: true,
      websiteUrl: "https://namma-physio-centre-psi.vercel.app",
      state: "idle",
      lastSyncAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      lastError: null,
      totalInquiries: 0,
    } as T;
  }
  if (m === "POST" && (path === "/inquiries/sync" || path === "/inquiries/connect")) {
    assertPerm(st, path === "/inquiries/connect" ? "settings.write" : "inquiries.read");
    return {
      added: 0,
      status: {
        configured: true,
        websiteUrl: "https://namma-physio-centre-psi.vercel.app",
        state: "idle",
        lastSyncAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
        totalInquiries: 0,
      },
    } as T;
  }
  if (m === "POST" && path === "/inquiries/disconnect") {
    assertPerm(st, "settings.write");
    return {
      status: {
        configured: false,
        websiteUrl: "https://namma-physio-centre-psi.vercel.app",
        state: "unconfigured",
        lastSyncAt: null,
        lastAttemptAt: null,
        lastError: null,
        totalInquiries: 0,
      },
    } as T;
  }

  if (m === "GET" && path === "/audit") {
    assertPerm(st, "audit.read");
    const q = (query.get("q") ?? "").trim().toLowerCase();
    return st.audit.filter((a) => !q || a.action.toLowerCase().includes(q) || (a.username ?? "").toLowerCase().includes(q)).slice(0, 300) as T;
  }

  // ---- Electronic Handwritten Signatures ----
  if (path === "/signatures/me") {
    const u = assertPerm(st, "signatures.manage");
    const existing = st.savedSignatures.find((s) => s.userId === u.id);
    if (m === "GET") {
      return {
        hasSaved: !!existing,
        signerName: existing?.signerName ?? (st.settings.clinic.signerName || u.display_name),
        signerQualification: existing?.signerQualification ?? (st.settings.clinic.signerQualification || ""),
        imageDataUrl: existing?.imageDataUrl ?? null,
        updatedAt: existing?.updatedAt ?? null,
      } as T;
    }
    if (m === "PUT") {
      const img = String(b.imageDataUrl ?? "").trim();
      if (!img.startsWith("data:image/png;base64,")) throw new DemoApiError(400, "Signature must be a PNG data URL");
      const signerName = String(b.signerName ?? "").trim();
      if (signerName.length < 2) throw new DemoApiError(400, "Enter signer name");
      const now = new Date().toISOString();
      const entry: DemoSavedSig = {
        userId: u.id,
        signerName,
        signerQualification: String(b.signerQualification ?? "").trim(),
        imageDataUrl: img,
        updatedAt: now,
      };
      st.savedSignatures = [...st.savedSignatures.filter((s) => s.userId !== u.id), entry];
      logAudit(st, u, "signature.save", "signature", u.id, { signerName });
      saveState(st);
      return { ok: true, updatedAt: now } as T;
    }
    if (m === "DELETE") {
      st.savedSignatures = st.savedSignatures.filter((s) => s.userId !== u.id);
      logAudit(st, u, "signature.delete", "signature", u.id);
      saveState(st);
      return { ok: true } as T;
    }
  }

  const docSigMatch = path.match(/^\/documents\/(invoice|receipt|detailed_bill|session_statement)\/(\d+)\/(signature|sign)$/);
  if (docSigMatch) {
    const docType = docSigMatch[1] as SignableDocumentType;
    const docId = Number(docSigMatch[2]);
    const action = docSigMatch[3];

    if (m === "GET" && action === "signature") {
      assertPerm(st, "invoices.read");
      const latest = [...st.docSignatures]
        .filter((s) => s.docType === docType && s.docId === docId)
        .sort((a, c) => c.docVersion - a.docVersion || c.id - a.id)[0] ?? null;
      return { signature: latest } as T;
    }

    if (m === "POST" && action === "sign") {
      const u = assertPerm(st, "signatures.manage");
      if (b.confirmAuthorization !== true) {
        throw new DemoApiError(400, "Explicit authorization confirmation is required before signing");
      }
      let imageDataUrl = "";
      let signerName = "";
      let signerQualification = "";
      if (b.mode === "drawn") {
        imageDataUrl = String(b.imageDataUrl ?? "").trim();
        if (!imageDataUrl.startsWith("data:image/png;base64,")) throw new DemoApiError(400, "Signature must be a PNG data URL");
        signerName = String(b.signerName ?? "").trim();
        if (signerName.length < 2) throw new DemoApiError(400, "Enter signer name");
        signerQualification = String(b.signerQualification ?? "").trim();
        if (b.saveForReuse) {
          st.savedSignatures = [
            ...st.savedSignatures.filter((s) => s.userId !== u.id),
            { userId: u.id, signerName, signerQualification, imageDataUrl, updatedAt: new Date().toISOString() },
          ];
        }
      } else {
        const saved = st.savedSignatures.find((s) => s.userId === u.id);
        if (!saved) throw new DemoApiError(400, "No saved signature found for your account");
        imageDataUrl = saved.imageDataUrl;
        signerName = String(b.signerName ?? "").trim() || saved.signerName;
        signerQualification = b.signerQualification !== undefined ? String(b.signerQualification).trim() : saved.signerQualification;
      }

      let docNo = `${docType.toUpperCase()}-${docId}`;
      let docVersion = 1;
      if (docType === "detailed_bill") {
        const bill = st.detailedBills.find((x) => x.id === docId);
        if (!bill) throw new DemoApiError(404, "Detailed physiotherapy bill not found");
        if (bill.status === "cancelled" || bill.status === "superseded") throw new DemoApiError(409, `Cannot sign a ${bill.status} bill`);
        docNo = bill.bill_no;
        docVersion = bill.version;
      } else if (docType === "invoice") {
        const inv = st.invoices.find((x) => x.id === docId);
        if (!inv) throw new DemoApiError(404, "Invoice not found");
        if (inv.status === "void") throw new DemoApiError(409, "Cannot sign a void invoice");
        docNo = inv.invoice_no;
      } else if (docType === "receipt") {
        const pay = st.payments.find((x) => x.id === docId);
        if (!pay) throw new DemoApiError(404, "Receipt not found");
        docNo = pay.receipt_no;
      } else {
        const pat = st.patients.find((x) => x.id === docId);
        if (!pat) throw new DemoApiError(404, "Patient not found");
        docNo = `STMT-${pat.patient_code}`;
        docVersion = st.docSignatures.filter((s) => s.docType === "session_statement" && s.docId === docId).length + 1;
      }

      if (st.docSignatures.some((s) => s.docType === docType && s.docId === docId && s.docVersion === docVersion)) {
        throw new DemoApiError(409, "This document version is already signed and locked against modification.");
      }

      const signedAt = new Date().toISOString();
      const sig: DocumentSignatureRecord = {
        id: st.docSignatures.reduce((mx, s) => Math.max(mx, s.id), 0) + 1,
        docType,
        docId,
        docNo,
        docVersion,
        payloadSha256: `demo-sha256-${docType}-${docId}-v${docVersion}`,
        imageDataUrl,
        signerUserId: u.id,
        signerUsername: u.username,
        signerName,
        signerQualification,
        signedAt,
      };
      st.docSignatures.push(sig);

      if (docType === "detailed_bill") {
        const bill = st.detailedBills.find((x) => x.id === docId)!;
        bill.status = "signed";
        bill.signed_at = signedAt;
        bill.updated_at = signedAt;
      }

      logAudit(st, u, "document.sign", docType, docId, { docNo, docVersion, signerName });
      saveState(st);
      return { signature: sig } as T;
    }
  }

  // ---- Detailed Physiotherapy Bills ----
  const mapDemoBillSummary = (r: DemoDetailedBillRow): DetailedBillSummary => {
    const p = st.patients.find((x) => x.id === r.patient_id);
    return {
      id: r.id,
      billNo: r.bill_no,
      version: r.version,
      parentBillId: r.parent_bill_id,
      supersededById: r.superseded_by_id,
      patientId: r.patient_id,
      patientCode: p?.patient_code ?? "",
      patientPhone: p?.phone ?? null,
      patientName: r.patient_name,
      patientAgeGender: r.patient_age_gender,
      referredBy: r.referred_by,
      treatmentStartDate: r.treatment_start_date,
      treatmentEndDate: r.treatment_end_date,
      billDate: r.bill_date,
      defaultCharge: r.default_charge,
      totalSessions: r.total_sessions,
      totalAmount: r.total_amount,
      amountInWords: r.amount_in_words,
      status: r.status,
      signedAt: r.signed_at,
      sharedAt: r.shared_at,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  };

  const loadDemoBillFull = (billId: number): DetailedBillFull => {
    const r = st.detailedBills.find((x) => x.id === billId);
    if (!r) throw new DemoApiError(404, "Detailed physiotherapy bill not found");
    const sessions = st.detailedBillSessions
      .filter((s) => s.detailed_bill_id === billId)
      .sort((a, c) => a.sl_no - c.sl_no)
      .map((s) => ({
        id: s.id,
        slNo: s.sl_no,
        sessionDate: s.session_date,
        dayName: s.day_name,
        particulars: s.particulars,
        amount: s.amount,
        sourceAppointmentId: s.source_appointment_id,
      }));
    const sig = [...st.docSignatures]
      .filter((s) => s.docType === "detailed_bill" && s.docId === billId)
      .sort((a, c) => c.docVersion - a.docVersion || c.id - a.id)[0] ?? null;
    return { ...mapDemoBillSummary(r), sessions, signature: sig };
  };

  const allocDemoBillNo = (date: string, previewOnly: boolean): string => {
    const fy = st.settings.invoice.resetEachFinancialYear ? financialYear(date) : null;
    const prefix = st.settings.invoice.detailedBillPrefix || "NPC-DB";
    const key = `seq:detailed_bill:${fy ?? "all"}`;
    let seq = (st.counters[key] ?? 0) + 1;
    for (;;) {
      const candidate = formatDocNumber(prefix, fy, seq, st.settings.invoice.padding);
      if (!st.detailedBills.some((x) => x.bill_no === candidate)) {
        if (!previewOnly) st.counters[key] = seq;
        return candidate;
      }
      seq++;
    }
  };

  if (m === "GET" && path === "/detailed-bills/next-number") {
    assertPerm(st, "detailed_bills.read");
    const d = query.get("date") || todayIST();
    return { billNo: allocDemoBillNo(d, true) } as T;
  }

  if (m === "GET" && path === "/detailed-bills/completed-sessions") {
    assertPerm(st, "detailed_bills.read");
    const patientId = Number(query.get("patientId"));
    if (!patientId) throw new DemoApiError(400, "Select a valid patient");
    const from = query.get("from") || "0000-01-01";
    const to = query.get("to") || "9999-12-31";
    if (to < from) throw new DemoApiError(400, "End date cannot be earlier than start date");
    const defaultCharge = st.settings.invoice.defaultSessionChargePaise ?? 120_000;
    const sessions = st.appointments
      .filter((a) => a.patient_id === patientId && a.status === "completed" && a.date >= from && a.date <= to)
      .sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time) || a.id - c.id)
      .map((a) => ({
        sourceAppointmentId: a.id,
        sessionDate: a.date,
        time: a.time,
        visitType: a.visit_type,
        particulars: "Physiotherapy Charges",
        amount: defaultCharge,
        notes: a.notes,
      }));
    return { sessions } as T;
  }

  if (m === "GET" && path === "/detailed-bills") {
    assertPerm(st, "detailed_bills.read");
    const q = (query.get("q") ?? "").trim().toLowerCase();
    const status = query.get("status") ?? "";
    const patientId = Number(query.get("patientId")) || 0;
    const filtered = st.detailedBills
      .filter((r) => {
        const p = st.patients.find((x) => x.id === r.patient_id);
        if (q && ![r.bill_no, r.patient_name, p?.patient_code, p?.phone].some((v) => v?.toLowerCase().includes(q))) return false;
        if (status && r.status !== status) return false;
        if (patientId > 0 && r.patient_id !== patientId) return false;
        return true;
      })
      .sort((a, c) => c.updated_at.localeCompare(a.updated_at) || c.id - a.id);
    return { total: filtered.length, items: filtered.map(mapDemoBillSummary) } as T;
  }

  if (m === "POST" && path === "/detailed-bills") {
    const u = assertPerm(st, "detailed_bills.write");
    const patient = st.patients.find((x) => x.id === Number(b.patientId));
    if (!patient) throw new DemoApiError(400, "Patient not found");
    if (patient.anonymised_at) throw new DemoApiError(409, "Cannot generate a bill for an anonymised patient record");
    const calc = calcDetailedBill(b.sessions ?? [], {
      treatmentStartDate: String(b.treatmentStartDate),
      treatmentEndDate: String(b.treatmentEndDate),
    });
    const billDate = String(b.billDate || todayIST());
    const billNo = String(b.billNo ?? "").trim() || allocDemoBillNo(billDate, false);
    if (st.detailedBills.some((x) => x.bill_no === billNo)) throw new DemoApiError(409, `Bill number "${billNo}" already exists`);
    const id = st.detailedBills.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
    const now = new Date().toISOString();
    st.detailedBills.push({
      id,
      bill_no: billNo,
      version: 1,
      parent_bill_id: null,
      superseded_by_id: null,
      patient_id: patient.id,
      patient_name: String(b.patientName).trim(),
      patient_age_gender: String(b.patientAgeGender ?? "").trim(),
      referred_by: String(b.referredBy ?? "").trim(),
      treatment_start_date: String(b.treatmentStartDate),
      treatment_end_date: String(b.treatmentEndDate),
      bill_date: billDate,
      default_charge: Number(b.defaultCharge ?? 120_000),
      total_sessions: calc.totalSessions,
      total_amount: calc.totalAmount,
      amount_in_words: calc.amountInWords,
      status: b.status === "ready_for_signature" ? "ready_for_signature" : "draft",
      signed_at: null,
      shared_at: null,
      notes: b.notes?.trim() || null,
      created_by: u.id,
      created_at: now,
      updated_at: now,
    });
    let nextSid = st.detailedBillSessions.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
    for (const s of calc.sessions) {
      st.detailedBillSessions.push({
        id: nextSid++,
        detailed_bill_id: id,
        sl_no: s.slNo,
        session_date: s.sessionDate,
        day_name: s.dayName,
        particulars: s.particulars,
        amount: s.amount,
        source_appointment_id: s.sourceAppointmentId,
      });
    }
    logAudit(st, u, "detailed_bill.create", "detailed_bill", id, { billNo, totalSessions: calc.totalSessions, totalAmount: calc.totalAmount });
    saveState(st);
    return loadDemoBillFull(id) as T;
  }

  const dbActionMatch = path.match(/^\/detailed-bills\/(\d+)(?:\/(status|duplicate|revise))?$/);
  if (dbActionMatch) {
    const billId = Number(dbActionMatch[1]);
    const sub = dbActionMatch[2];
    if (m === "GET" && !sub) {
      assertPerm(st, "detailed_bills.read");
      return loadDemoBillFull(billId) as T;
    }
    if (m === "PUT" && !sub) {
      const u = assertPerm(st, "detailed_bills.write");
      const cur = st.detailedBills.find((x) => x.id === billId);
      if (!cur) throw new DemoApiError(404, "Detailed physiotherapy bill not found");
      if (!["draft", "ready_for_signature"].includes(cur.status)) {
        throw new DemoApiError(409, `This bill is ${cur.status} and locked against silent modification. Create a revision instead.`);
      }
      const calc = calcDetailedBill(b.sessions ?? [], {
        treatmentStartDate: String(b.treatmentStartDate),
        treatmentEndDate: String(b.treatmentEndDate),
      });
      const nextBillNo = String(b.billNo ?? "").trim() || cur.bill_no;
      if (st.detailedBills.some((x) => x.bill_no === nextBillNo && x.id !== billId)) {
        throw new DemoApiError(409, `Bill number "${nextBillNo}" is already used`);
      }
      Object.assign(cur, {
        bill_no: nextBillNo,
        patient_id: Number(b.patientId),
        patient_name: String(b.patientName).trim(),
        patient_age_gender: String(b.patientAgeGender ?? "").trim(),
        referred_by: String(b.referredBy ?? "").trim(),
        treatment_start_date: String(b.treatmentStartDate),
        treatment_end_date: String(b.treatmentEndDate),
        bill_date: String(b.billDate),
        default_charge: Number(b.defaultCharge ?? 120_000),
        total_sessions: calc.totalSessions,
        total_amount: calc.totalAmount,
        amount_in_words: calc.amountInWords,
        status: b.status === "ready_for_signature" ? "ready_for_signature" : "draft",
        notes: b.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      });
      st.detailedBillSessions = st.detailedBillSessions.filter((s) => s.detailed_bill_id !== billId);
      let nextSid = st.detailedBillSessions.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
      for (const s of calc.sessions) {
        st.detailedBillSessions.push({
          id: nextSid++,
          detailed_bill_id: billId,
          sl_no: s.slNo,
          session_date: s.sessionDate,
          day_name: s.dayName,
          particulars: s.particulars,
          amount: s.amount,
          source_appointment_id: s.sourceAppointmentId,
        });
      }
      logAudit(st, u, "detailed_bill.update", "detailed_bill", billId);
      saveState(st);
      return loadDemoBillFull(billId) as T;
    }
    if (m === "POST" && sub === "status") {
      const u = assertPerm(st, "detailed_bills.write");
      const cur = loadDemoBillFull(billId);
      const nextStatus = String(b.status) as DetailedBillStatus;
      if (cur.status === "superseded") throw new DemoApiError(409, "Superseded bills cannot change status");
      if (cur.signature && (nextStatus === "draft" || nextStatus === "ready_for_signature")) {
        throw new DemoApiError(409, "Signed bills cannot be reverted to draft.");
      }
      const row = st.detailedBills.find((x) => x.id === billId)!;
      const now = new Date().toISOString();
      row.status = nextStatus;
      if (nextStatus === "shared") row.shared_at = now;
      row.updated_at = now;
      logAudit(st, u, `detailed_bill.${nextStatus}`, "detailed_bill", billId);
      saveState(st);
      return loadDemoBillFull(billId) as T;
    }
    if (m === "POST" && sub === "duplicate") {
      const u = assertPerm(st, "detailed_bills.write");
      const src = loadDemoBillFull(billId);
      const nowDate = todayIST();
      const now = new Date().toISOString();
      const newNo = allocDemoBillNo(nowDate, false);
      const newId = st.detailedBills.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
      st.detailedBills.push({
        id: newId,
        bill_no: newNo,
        version: 1,
        parent_bill_id: null,
        superseded_by_id: null,
        patient_id: src.patientId,
        patient_name: src.patientName,
        patient_age_gender: src.patientAgeGender,
        referred_by: src.referredBy,
        treatment_start_date: src.treatmentStartDate,
        treatment_end_date: src.treatmentEndDate,
        bill_date: nowDate,
        default_charge: src.defaultCharge,
        total_sessions: src.totalSessions,
        total_amount: src.totalAmount,
        amount_in_words: src.amountInWords,
        status: "draft",
        signed_at: null,
        shared_at: null,
        notes: src.notes,
        created_by: u.id,
        created_at: now,
        updated_at: now,
      });
      let nextSid = st.detailedBillSessions.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
      for (const s of src.sessions) {
        st.detailedBillSessions.push({
          id: nextSid++,
          detailed_bill_id: newId,
          sl_no: s.slNo,
          session_date: s.sessionDate,
          day_name: s.dayName,
          particulars: s.particulars,
          amount: s.amount,
          source_appointment_id: s.sourceAppointmentId,
        });
      }
      logAudit(st, u, "detailed_bill.duplicate", "detailed_bill", newId);
      saveState(st);
      return loadDemoBillFull(newId) as T;
    }
    if (m === "POST" && sub === "revise") {
      const u = assertPerm(st, "detailed_bills.write");
      const src = loadDemoBillFull(billId);
      if (src.status === "superseded") throw new DemoApiError(409, "Already superseded");
      const baseNo = src.billNo.replace(/-R\d+$/, "");
      const nextVer = src.version + 1;
      let revNo = `${baseNo}-R${nextVer}`;
      let sfx = nextVer;
      while (st.detailedBills.some((x) => x.bill_no === revNo)) {
        sfx++;
        revNo = `${baseNo}-R${sfx}`;
      }
      const now = new Date().toISOString();
      const newId = st.detailedBills.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
      st.detailedBills.push({
        id: newId,
        bill_no: revNo,
        version: nextVer,
        parent_bill_id: src.id,
        superseded_by_id: null,
        patient_id: src.patientId,
        patient_name: src.patientName,
        patient_age_gender: src.patientAgeGender,
        referred_by: src.referredBy,
        treatment_start_date: src.treatmentStartDate,
        treatment_end_date: src.treatmentEndDate,
        bill_date: src.billDate,
        default_charge: src.defaultCharge,
        total_sessions: src.totalSessions,
        total_amount: src.totalAmount,
        amount_in_words: src.amountInWords,
        status: "draft",
        signed_at: null,
        shared_at: null,
        notes: src.notes,
        created_by: u.id,
        created_at: now,
        updated_at: now,
      });
      const origRow = st.detailedBills.find((x) => x.id === src.id)!;
      origRow.status = "superseded";
      origRow.superseded_by_id = newId;
      origRow.updated_at = now;
      let nextSid = st.detailedBillSessions.reduce((mx, x) => Math.max(mx, x.id), 0) + 1;
      for (const s of src.sessions) {
        st.detailedBillSessions.push({
          id: nextSid++,
          detailed_bill_id: newId,
          sl_no: s.slNo,
          session_date: s.sessionDate,
          day_name: s.dayName,
          particulars: s.particulars,
          amount: s.amount,
          source_appointment_id: s.sourceAppointmentId,
        });
      }
      logAudit(st, u, "detailed_bill.revise", "detailed_bill", newId, { fromBillId: src.id, revNo });
      saveState(st);
      return loadDemoBillFull(newId) as T;
    }
  }

  throw new DemoApiError(404, `Demo endpoint not implemented: ${m} ${path}`);
}
