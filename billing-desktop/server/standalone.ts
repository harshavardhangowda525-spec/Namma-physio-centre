/**
 * Runs the local server without Electron (development / troubleshooting).
 * Still bound to 127.0.0.1 only.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./app";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.NPB_DATA_DIR ?? path.join(here, "..", "data-dev"));
const staticDir = process.env.NPB_STATIC_DIR ?? (process.env.NODE_ENV === "production" ? path.join(here, "..", "dist") : null);

const s = await startServer({ dataDir, port: Number(process.env.NPB_PORT ?? 5180), staticDir });
console.log(`Namma Physio Billing server running at ${s.url}`);
console.log(`Data folder: ${dataDir}`);
const stop = async () => {
  await s.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
