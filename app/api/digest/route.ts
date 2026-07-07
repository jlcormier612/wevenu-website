/**
 * /api/digest
 *
 * Daily digest delivery endpoint. Called by Vercel cron (once per hour, 7–9am local).
 * Authorization: Bearer {CRON_SECRET}
 */
import { NextResponse } from "next/server";
import { sendDailyDigests } from "@/lib/notifications/digest-engine";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendDailyDigests();
    console.log(`[cron] digest: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] digest error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendDailyDigests();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[digest] process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
