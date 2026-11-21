import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { authUrl, calendarConfigured } from "@/lib/calendar";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  if (!calendarConfigured()) return NextResponse.redirect(new URL("/admin?calendar=not-configured", req.url));
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("npc_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/admin/calendar", maxAge: 600 });
  return NextResponse.redirect(authUrl(state));
}
