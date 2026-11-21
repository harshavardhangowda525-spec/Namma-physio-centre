/**
 * Booking configuration. Preferred-time options are placeholders until the
 * clinic confirms its operating hours. All selections are PREFERENCES — the
 * clinic confirms the actual appointment.
 */
export const bookingConfig = {
  /** How far ahead patients may request (days). */
  maxDaysAhead: 60,
  /** Closed days (0 = Sunday). Empty until hours are confirmed. */
  closedWeekdays: [] as number[],
  preferredTimes: [
    "Early morning (before 10 AM)",
    "Late morning (10 AM – 12 PM)",
    "Early afternoon (12 – 2 PM)",
    "Late afternoon (3 – 5 PM)",
    "Evening (after 5 PM)",
    "Any time — clinic to suggest",
  ],
};
