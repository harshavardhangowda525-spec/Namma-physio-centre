/**
 * Single source of truth for clinic facts shown on the public website.
 *
 * RULE: Only enter information that the clinic has confirmed. Anything marked
 * `null` or `pendingConfirmation` is rendered as "to be confirmed" or hidden.
 * See /docs/CLINIC-CONFIRMATION-CHECKLIST.md at the repository root.
 */

export type DayHours = { day: string; open: string | null; note?: string };

export const WHATSAPP_PREFILLED_MESSAGE =
  "Hello, Namma Physiotherapy Centre. I would like to enquire about your physiotherapy services and appointment availability. Could you please assist me?";

export const clinic = {
  name: "Namma Physiotherapy Centre",
  legalAltName: "Namma Physio Centre",
  shortName: "Namma Physiotherapy",
  category: "Physiotherapy Centre",
  phoneDisplay: "+91 99164 53616",
  phoneE164: "+919916453616",
  /** Verified clinic contact number used for WhatsApp click-to-chat enquiries. */
  whatsappNumber: "919916453616",
  whatsappConfirmed: true,
  email: null as string | null,
  /** Authorized clinic Gmail used strictly by server-side website appointment notifications. */
  appointmentGmail: "Smilewithsidhu2008@gmail.com",
  address: {
    line1: "1st Cross, No. 5, Jambusawari Dinne Main Road",
    line2: "Kothnur, Royal County, 8th Phase, J. P. Nagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560083",
    country: "India",
    plusCode: "VH8J+M2 Bengaluru",
  },
  geo: { lat: 12.8667, lng: 77.5801 }, // approximate, derived from Plus Code VH8J+M2
  area: "JP Nagar 8th Phase, Bengaluru",
  timezone: "Asia/Kolkata",
  google: {
    /** Snapshot values from the supplied Google Maps listing. Updated dynamically when Google sync is configured. */
    rating: 5.0,
    reviewCount: 469,
    snapshotNote: "Google rating snapshot supplied by the clinic",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Namma+Physio+Centre+Jambusawari+Dinne+JP+Nagar+Bengaluru",
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=Namma+Physio+Centre%2C+Jambusawari+Dinne+Main+Road%2C+JP+Nagar+8th+Phase%2C+Bengaluru+560083",
    embedUrl:
      "https://www.google.com/maps?q=Namma+Physio+Centre,+Jambusawari+Dinne+Main+Road,+J.+P.+Nagar+8th+Phase,+Bengaluru+560083&output=embed",
  },
  /**
   * Operating hours are NOT confirmed. The listing only indicates a Saturday
   * afternoon break with reopening at 3 PM. Replace `null`s once confirmed.
   */
  hoursConfirmed: false,
  hours: [
    { day: "Monday", open: null },
    { day: "Tuesday", open: null },
    { day: "Wednesday", open: null },
    { day: "Thursday", open: null },
    { day: "Friday", open: null },
    { day: "Saturday", open: null, note: "Afternoon break, reopens 3 PM (per Google listing)" },
    { day: "Sunday", open: null },
  ] as DayHours[],
  social: {
    // Add only verified profiles, e.g. instagram: "https://instagram.com/…"
  } as Record<string, string>,
} as const;

export const doctor = {
  name: "Sunil Kumar",
  shortName: "Sunil Kumar",
  role: "Physiotherapist",
  experienceYears: 18, // confirmed by the clinic owner (Nov 2026)
  experienceHighlight: "18+ Years",
  experience: "18+ Years of Clinical Physiotherapy Experience",
  /** Fill only after the clinic provides verified certificates. Rendered as "To be confirmed" when empty. */
  qualifications: [] as string[],
  certifications: [] as string[],
  registration: null as string | null,
  biography: [
    "Sunil Kumar brings over eighteen years of clinical physiotherapy and rehabilitation experience, with a patient-centered approach focused on understanding individual conditions, functional limitations and recovery needs.",
    "His treatment approach combines detailed clinical assessment, evidence-based physiotherapy practices and customized treatment protocols. Each rehabilitation program is planned according to the patient's condition, physical abilities and individual recovery goals.",
    "At Namma Physiotherapy Centre, the focus is on supporting patients in improving mobility, regaining strength, managing physical limitations and progressing towards greater functional independence through structured physiotherapy care.",
  ],
  /** Areas of clinical care (not described as formally certified specializations unless verified credentials are provided). */
  areasOfTreatment: [
    "Orthopedic rehabilitation",
    "Sports injury rehabilitation",
    "Post-surgical rehabilitation",
    "Knee rehabilitation",
    "Shoulder rehabilitation",
    "Spine and back pain rehabilitation",
    "Neurological rehabilitation",
    "Geriatric physiotherapy",
    "Functional mobility rehabilitation",
    "Home-based physiotherapy",
  ],
  practiceHighlights: [
    {
      title: "Individualized Clinical Assessment",
      detail: "Every plan begins by evaluating movement, strength, functional limitations and everyday activity demands.",
    },
    {
      title: "Evidence-Based Physiotherapy Care",
      detail: "Treatment decisions draw on established clinical reasoning and current physiotherapy evidence rather than one-size-fits-all routines.",
    },
    {
      title: "Customized Treatment Protocols",
      detail: "Exercises and hands-on techniques are tailored to your recovery stage, surgical precautions and personal goals.",
    },
    {
      title: "Clear Guidance & Progress Reviews",
      detail: "Plain-language explanations, structured home exercise programs and regular reassessment as mobility improves.",
    },
  ],
  photo: null as string | null, // e.g. "/images/sunil-kumar.jpg" once authentic clinic portrait is supplied
};

export const developerAttribution = {
  label: "Designed & Developed by Infinity Web & Apps",
  name: "Infinity Web & Apps",
  tagline: "Websites. Mobile Apps. Digital Growth.",
  url: process.env.NEXT_PUBLIC_DEVELOPER_URL || "https://infinity-web-apps.vercel.app",
  expandedCta: "Want a digital experience like this for your business? Explore Infinity Web & Apps.",
  /** Kept false until clinic owner approves publishing the expanded promotional CTA. */
  showExpandedCta: process.env.NEXT_PUBLIC_SHOW_EXPANDED_DEV_CTA === "true",
} as const;

export function whatsappChatUrl(message = WHATSAPP_PREFILLED_MESSAGE): string {
  return `https://wa.me/${clinic.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/** Mark copy that still needs client sign-off. Shown as a subtle badge in non-production builds. */
export const DRAFT_COPY = true;

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nammaphysiocentre.in";

export const fullAddress = `${clinic.address.line1}, ${clinic.address.line2}, ${clinic.address.city}, ${clinic.address.state} ${clinic.address.postalCode}`;
