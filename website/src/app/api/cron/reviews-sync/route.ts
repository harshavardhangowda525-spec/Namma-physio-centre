import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { syncGoogleReviewsNow } from "@/lib/reviews";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const hasCronAuth = Boolean(secret && auth === `Bearer ${secret}`);
  const admin = await isAdmin();

  if (secret && !hasCronAuth && !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!secret && process.env.NODE_ENV === "production" && !admin) {
    return NextResponse.json({ error: "CRON_SECRET or admin session required" }, { status: 401 });
  }

  const res = await syncGoogleReviewsNow();
  return NextResponse.json(res, { status: res.ok ? 200 : 207 });
}
