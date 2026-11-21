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
