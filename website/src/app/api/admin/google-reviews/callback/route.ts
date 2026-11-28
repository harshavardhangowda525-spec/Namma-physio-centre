import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { exchangeGbpCode, syncGoogleReviewsNow } from "@/lib/reviews";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("npc_gbp_oauth_state")?.value;
  jar.delete("npc_gbp_oauth_state");

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/admin?reviews=error", req.url));
  }
  try {
    await exchangeGbpCode(code);
    const synced = await syncGoogleReviewsNow();
    return NextResponse.redirect(
      new URL(`/admin?reviews=${synced.ok ? "connected" : "auth_saved"}`, req.url),
    );
  } catch (e) {
    console.error("[reviews] GBP OAuth callback failed", e);
    return NextResponse.redirect(new URL("/admin?reviews=error", req.url));
  }
}
