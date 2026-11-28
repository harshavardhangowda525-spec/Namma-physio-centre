import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { ZodError } from "zod";
import { BillingError } from "../shared/billing";
import { requireAuth, sessionMiddleware } from "./auth";
import { startScheduler } from "./backup";
import { plainSecretStore, type Ctx, type SecretStore } from "./context";
import { openDatabase } from "./db";
import { startInquirySync } from "./inquiry-sync";
import { adminRoutes, authRoutes } from "./routes/admin";
import { coreRoutes, HttpError } from "./routes/core";
import { detailedBillAndSignatureRoutes } from "./routes/detailed-bills";
import { inquiryRoutes, inquiryWebhookRoutes } from "./routes/inquiries";
import { reportRoutes } from "./routes/reports";

export const HOST = "127.0.0.1";

export type ServerOptions = {
  dataDir: string;
  port?: number; // 0 = random free port
  staticDir?: string | null; // built UI; omitted in development (Vite serves it)
  secretStore?: SecretStore;
  scheduler?: boolean;
  inquirySync?: boolean;
  inquirySyncIntervalMs?: number;
  log?: (msg: string) => void;
};

export function createContext(dataDir: string, secretStore: SecretStore = plainSecretStore): Ctx {
  const dbFile = path.join(dataDir, "namma-physio.db");
  const ctx: Ctx = {
    db: openDatabase(dbFile),
    dbFile,
    dataDir,
    secretStore,
    reopen() {
      ctx.db = openDatabase(dbFile);
    },
  };
  return ctx;
}

export function createApp(ctx: Ctx, opts: { staticDir?: string | null; allowedPorts: () => number[] }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);

  // 1) Only accept requests addressed to the loopback interface (blocks DNS-rebinding).
  app.use((req, res, next) => {
    const host = (req.headers.host ?? "").toLowerCase();
    const ok = opts.allowedPorts().some((p) => host === `127.0.0.1:${p}` || host === `localhost:${p}`);
    if (!ok) return void res.status(421).send("Misdirected request");
    next();
  });

  // 2) Security headers. No third-party resources, no analytics.
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    next();
  });

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  // 3) CSRF: state-changing requests must come from our own origin.
  api.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin) {
      const ok = opts.allowedPorts().some((p) => origin === `http://127.0.0.1:${p}` || origin === `http://localhost:${p}`);
      if (!ok) return void res.status(403).json({ error: "Cross-origin request blocked" });
    } else if (req.headers["sec-fetch-site"] && req.headers["sec-fetch-site"] !== "same-origin") {
      return void res.status(403).json({ error: "Cross-site request blocked" });
    }
    next();
  });
  api.use(express.json({ limit: "2mb" }));
  api.use(inquiryWebhookRoutes(ctx));
  api.use(sessionMiddleware(ctx));
  api.use(authRoutes(ctx));
  api.use(requireAuth);
  api.use(coreRoutes(ctx));
  api.use(detailedBillAndSignatureRoutes(ctx));
  api.use(inquiryRoutes(ctx));
  api.use(reportRoutes(ctx));
  api.use(adminRoutes(ctx));
  api.use((_req, res) => void res.status(404).json({ error: "Not found" }));
  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return void res.status(400).json({ error: first ? `${first.path.join(".") ? first.path.join(".") + ": " : ""}${first.message}` : "Invalid input", issues: err.issues });
    }
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
    if (err instanceof BillingError) return void res.status(400).json({ error: err.message });
    if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") return void res.status(400).json({ error: "Invalid request body" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Your data has not been changed." });
  });
  app.use("/api", api);

  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { index: false, maxAge: "1h" }));
    // SPA fallback
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(path.join(opts.staticDir!, "index.html"));
    });
  }
  return app;
}

/** Starts the local server bound to 127.0.0.1 ONLY. Never 0.0.0.0. */
export async function startServer(opts: ServerOptions) {
  const ctx = createContext(opts.dataDir, opts.secretStore);
  const ports: number[] = [];
  const app = createApp(ctx, { staticDir: opts.staticDir, allowedPorts: () => ports });
  const server = await new Promise<import("node:http").Server>((resolve, reject) => {
    const s = app.listen(opts.port ?? 0, HOST, () => resolve(s));
    s.on("error", reject);
  });
  const port = (server.address() as AddressInfo).port;
  ports.push(port);
  if (process.env.NPB_DEV_UI_PORT) ports.push(Number(process.env.NPB_DEV_UI_PORT)); // Vite dev proxy
  const stopScheduler = opts.scheduler === false ? () => {} : startScheduler(ctx, opts.log);
  const enableInquirySync = opts.inquirySync ?? opts.scheduler !== false;
  const stopInquirySync = enableInquirySync ? startInquirySync(ctx, { intervalMs: opts.inquirySyncIntervalMs, log: opts.log }) : () => {};
  return {
    ctx,
    port,
    url: `http://${HOST}:${port}`,
    async close() {
      stopScheduler();
      stopInquirySync();
      await new Promise((r) => server.close(r));
      ctx.db.close();
    },
  };
}
