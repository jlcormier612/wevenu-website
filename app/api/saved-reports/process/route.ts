/**
 * /api/saved-reports/process
 *
 * Scheduled Saved Report delivery. Called by Vercel cron (hourly, same
 * cadence as /api/digest) — the RPC itself only matches schedules due
 * "today" for the correct day-of-week, so an hourly tick just means
 * delivery happens within an hour of the day rolling over, not that it
 * sends repeatedly (last_sent_at gates that, same as the digest).
 * Authorization: Bearer {CRON_SECRET}
 */
import { NextResponse } from "next/server";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/auth/cron-auth";
import { sendDueSavedReports } from "@/lib/saved-reports/schedule-engine";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }
  try {
    const result = await sendDueSavedReports();
    console.log(`[cron] saved-reports: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] saved-reports error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
