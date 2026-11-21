import "server-only";
import { randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function makeReference(date = new Date()): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit", day: "2-digit" })
    .format(date)
    .replace(/-/g, "");
  let s = "";
  for (let i = 0; i < 5; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `NPC-${ymd}-${s}`;
}
