/** Client-safe helper to infer a default HH:MM time from a preferred time slot string. */
export function inferDefaultTimeSlot(preferredTime: string): string {
  if (/^\d{2}:\d{2}$/.test(preferredTime)) return preferredTime;
  const lower = preferredTime.toLowerCase();
  if (lower.includes("early morning")) return "09:30";
  if (lower.includes("late morning")) return "10:30";
  if (lower.includes("early afternoon")) return "12:30";
  if (lower.includes("late afternoon")) return "15:30";
  if (lower.includes("evening")) return "17:30";
  return "10:00";
}
