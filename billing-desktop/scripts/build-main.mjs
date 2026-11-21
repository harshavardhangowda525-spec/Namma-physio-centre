// Bundles the Electron main process, preload and standalone server with esbuild.
import { build } from "esbuild";

const common = { bundle: true, platform: "node", target: "node20", sourcemap: false, external: ["electron", "better-sqlite3"], logLevel: "info" };
await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.js", format: "esm", banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" } });
await build({ ...common, entryPoints: ["server/standalone.ts"], outfile: "dist-electron/standalone.js", format: "esm", banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" } });
await build({ ...common, entryPoints: ["electron/preload.cts"], outfile: "dist-electron/preload.cjs", format: "cjs" });
