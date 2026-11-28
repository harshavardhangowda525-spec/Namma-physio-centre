import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { gmailAuthUrl, gmailOAuthConfigured } from "@/lib/gmail";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  if (!gmailOAuthConfigured()) return NextResponse.redirect(new URL("/admin?gmail=unconfigured", req.url));

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("npc_gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/gmail/callback",
    maxAge: 600,
  });
  return NextResponse.redirect(gmailAuthUrl(state));
}
