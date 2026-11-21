/**
 * Runs the local server without Electron (development / troubleshooting).
 * Still bound to 127.0.0.1 only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./app";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.NPB_DATA_DIR ?? path.join(here, "..", "data-dev"));
// Serve the built UI whenever it exists (npm start); `npm run dev` uses Vite instead.
const builtUi = path.join(here, "..", "dist");
const staticDir = process.env.NPB_STATIC_DIR ?? (process.env.NPB_DEV_UI_PORT ? null : fs.existsSync(path.join(builtUi, "index.html")) ? builtUi : null);

const s = await startServer({ dataDir, port: Number(process.env.NPB_PORT ?? 5180), staticDir });
console.log(`Namma Physio Billing server running at ${s.url}`);
console.log(`Data folder: ${dataDir}`);
if (!staticDir && !process.env.NPB_DEV_UI_PORT) console.log("UI not built yet: run `npm run build` first, then `npm start`.");
const stop = async () => {
  await s.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
