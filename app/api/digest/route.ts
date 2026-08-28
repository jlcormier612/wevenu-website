/**
 * /api/digest
 *
 * Daily digest delivery endpoint. Called by Vercel cron (once per hour, 7–9am local).
 * Authorization: Bearer {CRON_SECRET}
 */
import { NextResponse } from "next/server";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/auth/cron-auth";
import { sendDailyDigests } from "@/lib/notifications/digest-engine";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
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
    return cronUnauthorizedResponse();
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
