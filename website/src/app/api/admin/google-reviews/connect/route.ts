import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { gbpAuthUrl, gbpOAuthConfigured } from "@/lib/reviews";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  if (!gbpOAuthConfigured()) return NextResponse.redirect(new URL("/admin?reviews=unconfigured", req.url));

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("npc_gbp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/google-reviews/callback",
    maxAge: 600,
  });
  return NextResponse.redirect(gbpAuthUrl(state));
}
