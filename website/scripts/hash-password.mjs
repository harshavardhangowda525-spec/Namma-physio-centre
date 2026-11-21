// Usage: npm run admin:hash -- "your-strong-password"
import { randomBytes, scryptSync } from "crypto";

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error('Provide a password of at least 12 characters: npm run admin:hash -- "…"');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
console.log("ADMIN_PASSWORD_HASH=scrypt$" + salt.toString("hex") + "$" + hash.toString("hex"));
