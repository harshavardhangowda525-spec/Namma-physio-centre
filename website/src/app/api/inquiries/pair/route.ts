import { NextResponse } from "next/server";
import { z } from "zod";
import { adminConfigured, verifyPassword } from "@/lib/admin-auth";
import { StorageUnavailableError } from "@/lib/db";
import { issueSyncToken } from "@/lib/inquiry-sync";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const pairSchema = z.object({
  password: z.string().min(1, "Enter the website admin password"),
  deviceLabel: z.string().trim().max(80).optional(),
});

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!rateLimit(`sync-pair:${clientIp(req.headers)}`, 5, 15 * 60_000)) {
    return NextResponse.json(
      { error: "Too many connection attempts. Please wait 15 minutes and try again." },
      { status: 429, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  const parsed = pairSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Website admin authentication is not configured on this server. Use a sync token instead." },
      { status: 503, headers: NO_STORE },
    );
  }

  if (!verifyPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Incorrect website admin password" }, { status: 401, headers: NO_STORE });
  }

  try {
    const token = await issueSyncToken(parsed.data.deviceLabel);
    return NextResponse.json({ token }, { status: 201, headers: NO_STORE });
  } catch (e) {
    console.error("[inquiry-sync] failed to issue sync token", e instanceof StorageUnavailableError ? e.message : e);
    return NextResponse.json(
      { error: "Could not save sync credentials right now." },
      { status: 503, headers: NO_STORE },
    );
  }
}
