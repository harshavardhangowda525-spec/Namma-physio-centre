import { z } from "zod";
import { bookingConfig } from "@/content/booking";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const normaliseMobile = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};

const base = {
  patientName: z
    .string({ required_error: "Please enter the patient's name" })
    .trim()
    .min(2, "Please enter the patient's name")
    .max(80, "Name is too long"),
  mobile: z
    .string({ required_error: "Enter a valid 10-digit Indian mobile number" })
    .trim()
    .transform(normaliseMobile)
    .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number"),
  email: z
    .string({ required_error: "Please enter a valid email address for appointment updates" })
    .trim()
    .min(5, "Please enter a valid email address")
    .max(120, "Email address is too long")
    .email("Enter a valid email address"),
  requestedService: z
    .string()
    .trim()
    .max(140, "Service name is too long")
    .optional()
    .transform((v) => (v ? v : undefined)),
  preferredDate: z
    .string({ required_error: "Choose a preferred date" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a preferred date")
    .refine((v) => v >= todayIST(), "Please choose today or a future date")
    .refine(
      (v) => v <= addDays(todayIST(), bookingConfig.maxDaysAhead),
      `Please choose a date within ${bookingConfig.maxDaysAhead} days`,
    )
    .refine(
      (v) => !bookingConfig.closedWeekdays.includes(new Date(v + "T00:00:00Z").getUTCDay()),
      "The clinic is closed on this day",
    ),
  preferredTime: z
    .string({ required_error: "Choose a preferred time" })
    .refine((v) => bookingConfig.preferredTimes.includes(v), "Choose a preferred time"),
  reason: optionalText(200),
  notes: optionalText(1000),
  consent: z.literal(true, { errorMap: () => ({ message: "Please confirm consent to continue" }) }),
  /** Honeypot: must stay empty. */
  company: z.string().max(0).optional(),
};

export const clinicVisitSchema = z.object({ visitType: z.literal("clinic"), ...base });
export const homeVisitSchema = z.object({
  visitType: z.literal("home"),
  ...base,
  address: z
    .string({ required_error: "Please enter the complete home address" })
    .trim()
    .min(10, "Please enter the complete home address")
    .max(300),
  locality: z
    .string({ required_error: "Please enter the area or locality" })
    .trim()
    .min(2, "Please enter the area or locality")
    .max(80),
  pinCode: z
    .string({ required_error: "Enter a valid 6-digit PIN code" })
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
});

export const bookingSchema = z.discriminatedUnion("visitType", [clinicVisitSchema, homeVisitSchema]);
export type BookingInput = z.input<typeof bookingSchema>;
export type BookingData = z.output<typeof bookingSchema>;
