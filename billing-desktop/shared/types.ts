export type Role = "admin" | "physiotherapist" | "reception";

export const PERMISSIONS = {
  "patients.read": ["admin", "physiotherapist", "reception"],
  "patients.write": ["admin", "physiotherapist", "reception"],
  "patients.delete": ["admin"],
  "clinical.read": ["admin", "physiotherapist"],
  "clinical.write": ["admin", "physiotherapist"],
  "invoices.read": ["admin", "physiotherapist", "reception"],
  "invoices.write": ["admin", "reception", "physiotherapist"],
  "invoices.void": ["admin"],
  "payments.write": ["admin", "reception"],
  "appointments.read": ["admin", "physiotherapist", "reception"],
  "appointments.write": ["admin", "physiotherapist", "reception"],
  "inquiries.read": ["admin", "physiotherapist", "reception"],
  "detailed_bills.read": ["admin", "physiotherapist", "reception"],
  "detailed_bills.write": ["admin", "physiotherapist", "reception"],
  "signatures.manage": ["admin", "physiotherapist"],
  "reports.read": ["admin"],
  "dashboard.financial": ["admin"],
  "settings.write": ["admin"],
  "users.manage": ["admin"],
  "backups.manage": ["admin"],
  "audit.read": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, p: Permission) {
  return !!role && (PERMISSIONS[p] as readonly Role[]).includes(role);
}

export type SessionUser = { id: number; username: string; displayName: string; role: Role; mustChangePassword: boolean };

export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show";
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ["requested", "confirmed", "completed", "cancelled", "no_show"];

export type AppointmentInquiry = {
  id: number;
  remoteId: number | null;
  reference: string;
  visitType: "clinic" | "home";
  patientName: string;
  mobile: string;
  email: string | null;
  address: string | null;
  locality: string | null;
  pinCode: string | null;
  preferredDate: string;
  preferredTime: string;
  reason: string | null;
  notes: string | null;
  consentAt: string;
  submittedAt: string;
  syncedAt: string;
};

export type InquirySyncState = "unconfigured" | "idle" | "syncing" | "offline" | "auth_error" | "error";

export type InquirySyncStatus = {
  configured: boolean;
  websiteUrl: string;
  state: InquirySyncState;
  lastSyncAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  totalInquiries: number;
};

export type SignableDocumentType = "invoice" | "receipt" | "detailed_bill" | "session_statement";

export type SavedSignatureInfo = {
  hasSaved: boolean;
  signerName: string;
  signerQualification: string;
  imageDataUrl: string | null;
  updatedAt: string | null;
};

export type DocumentSignatureRecord = {
  id: number;
  docType: SignableDocumentType;
  docId: number;
  docNo: string;
  docVersion: number;
  payloadSha256: string;
  imageDataUrl: string;
  signerUserId: number;
  signerUsername: string;
  signerName: string;
  signerQualification: string;
  signedAt: string;
};

export type DetailedBillStatus =
  | "draft"
  | "ready_for_signature"
  | "signed"
  | "finalized"
  | "shared"
  | "cancelled"
  | "superseded";

export type DetailedBillSessionRow = {
  id?: number;
  slNo: number;
  sessionDate: string;
  dayName: string;
  particulars: string;
  amount: number; // paise
  sourceAppointmentId: number | null;
};

export type DetailedBillSummary = {
  id: number;
  billNo: string;
  version: number;
  parentBillId: number | null;
  supersededById: number | null;
  patientId: number;
  patientCode: string;
  patientPhone: string | null;
  patientName: string;
  patientAgeGender: string;
  referredBy: string;
  treatmentStartDate: string;
  treatmentEndDate: string;
  billDate: string;
  defaultCharge: number;
  totalSessions: number;
  totalAmount: number;
  amountInWords: string;
  status: DetailedBillStatus;
  signedAt: string | null;
  sharedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DetailedBillFull = DetailedBillSummary & {
  sessions: DetailedBillSessionRow[];
  signature: DocumentSignatureRecord | null;
};
