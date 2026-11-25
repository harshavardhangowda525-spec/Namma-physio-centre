import { NextResponse } from "next/server";
import { listInquiriesForSync, StorageUnavailableError } from "@/lib/db";
import { verifySyncBearer } from "@/lib/inquiry-sync";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  if (!rateLimit(`sync-pull:${clientIp(req.headers)}`, 120, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: NO_STORE });
  }

  try {
    const authorized = await verifySyncBearer(req.headers.get("authorization"));
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized sync token" }, { status: 401, headers: NO_STORE });
    }

    const url = new URL(req.url);
    const afterRaw = Number(url.searchParams.get("after_id") ?? "0");
    const limitRaw = Number(url.searchParams.get("limit") ?? "200");
    const afterId = Number.isFinite(afterRaw) && afterRaw > 0 ? Math.floor(afterRaw) : 0;
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 200;

    const inquiries = await listInquiriesForSync(afterId, limit);
    const maxId = inquiries.reduce((acc, item) => Math.max(acc, item.id), afterId);

    return NextResponse.json(
      {
        inquiries,
        nextCursor: maxId,
        hasMore: inquiries.length >= limit,
        serverTime: new Date().toISOString(),
      },
      { status: 200, headers: NO_STORE },
    );
  } catch (e) {
    console.error("[inquiry-sync] failed to list inquiries", e instanceof StorageUnavailableError ? e.message : e);
    return NextResponse.json(
      { error: "Inquiry storage is temporarily unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
}
