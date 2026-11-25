import { Router } from "express";
import { z } from "zod";
import { requirePerm } from "../auth";
import type { Ctx } from "../context";
import {
  connectWebsiteSync,
  disconnectWebsiteSync,
  getInquirySyncStatus,
  listLocalInquiries,
  receiveInquiryWebhook,
  syncInquiriesNow,
} from "../inquiry-sync";

/** Loopback-only webhook endpoint authenticated via shared sync Bearer token. */
export function inquiryWebhookRoutes(ctx: Ctx) {
  const r = Router();
  r.post("/inquiries/webhook", (req, res) => {
    const result = receiveInquiryWebhook(ctx, req.headers.authorization, req.body);
    res.status(201).json({ ok: true, added: result.added });
  });
  return r;
}

export function inquiryRoutes(ctx: Ctx) {
  const r = Router();

  r.get("/inquiries", requirePerm("inquiries.read"), (req, res) => {
    const { items, total } = listLocalInquiries(ctx.db, {
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      visitType: typeof req.query.visitType === "string" ? req.query.visitType : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    });
    res.json({ items, total, sync: getInquirySyncStatus(ctx) });
  });

  r.get("/inquiries/status", requirePerm("inquiries.read"), (_req, res) => {
    res.json(getInquirySyncStatus(ctx));
  });

  r.post("/inquiries/sync", requirePerm("inquiries.read"), async (_req, res) => {
    const result = await syncInquiriesNow(ctx);
    res.json(result);
  });

  r.post("/inquiries/connect", requirePerm("settings.write"), async (req, res) => {
    const d = z
      .object({
        websiteUrl: z.string().trim().min(1).max(300),
        password: z.string().max(200).optional(),
        token: z.string().max(500).optional(),
      })
      .parse(req.body);
    const result = await connectWebsiteSync(ctx, d, req.user!);
    res.json(result);
  });

  r.post("/inquiries/disconnect", requirePerm("settings.write"), (req, res) => {
    res.json({ status: disconnectWebsiteSync(ctx, req.user!) });
  });

  return r;
}
