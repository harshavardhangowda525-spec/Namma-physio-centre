import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { exchangeCode } from "@/lib/calendar";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  const jar = await cookies();
  const expected = jar.get("npc_oauth_state")?.value;
  jar.delete("npc_oauth_state");
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) {
    return NextResponse.redirect(new URL("/admin?calendar=error", req.url));
  }
  try {
    await exchangeCode(code);
    return NextResponse.redirect(new URL("/admin?calendar=connected", req.url));
  } catch (e) {
    console.error("[calendar] connect failed", e);
    return NextResponse.redirect(new URL("/admin?calendar=error", req.url));
  }
}
