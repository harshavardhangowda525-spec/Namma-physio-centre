/**
 * Single source of truth for clinic facts shown on the public website.
 *
 * RULE: Only enter information that the clinic has confirmed. Anything marked
 * `null` or `pendingConfirmation` is rendered as "to be confirmed" or hidden.
 * See /docs/CLINIC-CONFIRMATION-CHECKLIST.md at the repository root.
 */

export type DayHours = { day: string; open: string | null; note?: string };

export const clinic = {
  name: "Namma Physio Centre",
  shortName: "Namma Physio",
  category: "Physiotherapy Centre",
  phoneDisplay: "+91 99164 53616",
  phoneE164: "+919916453616",
  /** WhatsApp availability on this number is NOT yet confirmed. */
  whatsappNumber: "919916453616",
  whatsappConfirmed: false,
  email: null as string | null,
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
  area: "JP Nagar, Bengaluru",
  google: {
    /** Snapshot values from the supplied Google Maps listing. Updated live when the Places API is configured. */
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
  name: "Dr. Sunil Kumar",
  shortName: "Dr. Sunil",
  role: "Physiotherapist",
  /** Fill only after the clinic confirms. Rendered as "To be confirmed" when empty. */
  qualifications: [] as string[],
  experience: null as string | null,
  registration: null as string | null,
  /** Areas supported by supplied information (patient reviews) and client confirmation (Nov 2026). */
  areasOfTreatment: [
    "Back and neck pain",
    "Shoulder pain",
    "Knee injury rehabilitation",
    "Meniscus tear rehabilitation",
    "Post-surgical rehabilitation",
    "Knee replacement rehabilitation",
  ],
  photo: null as string | null, // e.g. "/images/dr-sunil.jpg" once supplied by the clinic
};

/** Mark copy that still needs client sign-off. Shown as a subtle badge in non-production builds. */
export const DRAFT_COPY = true;

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nammaphysiocentre.in";

export const fullAddress = `${clinic.address.line1}, ${clinic.address.line2}, ${clinic.address.city}, ${clinic.address.state} ${clinic.address.postalCode}`;
