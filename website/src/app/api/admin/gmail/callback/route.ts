import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { exchangeGmailCode } from "@/lib/gmail";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("npc_gmail_oauth_state")?.value;
  jar.delete("npc_gmail_oauth_state");

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/admin?gmail=error", req.url));
  }
  try {
    await exchangeGmailCode(code);
    return NextResponse.redirect(new URL("/admin?gmail=authorized_pending_test", req.url));
  } catch (e) {
    console.error("[gmail] OAuth callback failed", e);
    return NextResponse.redirect(new URL("/admin?gmail=error", req.url));
  }
}
