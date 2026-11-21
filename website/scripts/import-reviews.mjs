// Imports an AUTHORISED review export into the imported_reviews table.
//
// Usage: DATABASE_URL=… npm run reviews:import -- path/to/reviews.json --source "Google Business Profile export, 2026-11"
//
// Expected JSON: an array of { id, author, rating, date?, text }
// Rules enforced:
//   - every record needs a stable unique id, an author, rating 1–5 and non-empty text
//   - duplicate ids or duplicate (author + text) records are rejected, never "padded"
//   - the import must declare its source (--source) for the audit trail
// Only import data you are authorised to use under Google's terms.
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const [file, flag, source] = process.argv.slice(2);
if (!file || flag !== "--source" || !source) {
  console.error('Usage: npm run reviews:import -- reviews.json --source "<where this export came from>"');
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(data)) throw new Error("Expected a JSON array");

const errors = [];
const ids = new Set();
const fingerprints = new Set();
const clean = [];
data.forEach((r, i) => {
  const where = `record ${i + 1}`;
  if (!r || typeof r !== "object") {
    errors.push(`${where}: not an object`);
    return;
  }
  const id = String(r.id ?? "").trim();
  const author = String(r.author ?? "").trim();
  const text = String(r.text ?? "").trim();
  const rating = Number(r.rating);
  const date = r.date ? String(r.date).slice(0, 10) : null;
  if (!id) errors.push(`${where}: missing id`);
  if (!author) errors.push(`${where}: missing author`);
  if (!text) errors.push(`${where}: empty text (rating-only reviews are not imported)`);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push(`${where}: rating must be 1–5`);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`${where}: date must be YYYY-MM-DD`);
  if (ids.has(id)) errors.push(`${where}: duplicate id ${id}`);
  const fp = `${author.toLowerCase()}|${text.toLowerCase()}`;
  if (fingerprints.has(fp)) errors.push(`${where}: duplicate review content`);
  ids.add(id);
  fingerprints.add(fp);
  clean.push({ id, author, text, rating, date });
});

if (errors.length) {
  console.error(`Import rejected (${errors.length} problems):\n - ` + errors.slice(0, 50).join("\n - "));
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.log(`Validation passed for ${clean.length} reviews (dry run: DATABASE_URL not set).`);
  process.exit(0);
}
const sql = neon(process.env.DATABASE_URL);
for (const r of clean) {
  await sql`INSERT INTO imported_reviews (id, author, rating, review_date, text, source_note)
    VALUES (${r.id}, ${r.author}, ${r.rating}, ${r.date}, ${r.text}, ${source})
    ON CONFLICT (id) DO UPDATE SET author = EXCLUDED.author, rating = EXCLUDED.rating,
      review_date = EXCLUDED.review_date, text = EXCLUDED.text, source_note = EXCLUDED.source_note, imported_at = now()`;
}
console.log(`Imported ${clean.length} reviews from "${source}".`);
