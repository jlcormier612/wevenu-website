/**
 * /api/communication/scheduled/process
 *
 * Scheduled Sends delivery engine endpoint. Processes due messages in
 * batches of 50. Mirrors /api/notifications/process's auth pattern exactly.
 *
 * GET  — called by Vercel cron (every 5 minutes per vercel.json — tighter
 *        than the 30-minute reminders cron since a coordinator picked a
 *        specific time and expects it to fire close to on time)
 *        Authorization: Bearer {CRON_SECRET}
 *
 * POST — manual trigger, same secret pattern as /api/notifications/process
 *        Authorization: x-notifications-secret: {NOTIFICATIONS_SECRET}
 *
 * In development: both methods work without any secret configured.
 */

import { NextResponse } from "next/server";

import { processDueScheduledMessages } from "@/lib/scheduled-messages/processor";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function isManualAuthorized(request: Request): boolean {
  const secret = process.env.NOTIFICATIONS_SECRET;
  if (!secret) return true;
  return request.headers.get("x-notifications-secret") === secret;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDueScheduledMessages();
    console.log(`[cron] scheduled sends processed: ${result.sent} sent, ${result.failed} failed`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] scheduled send error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isManualAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDueScheduledMessages();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[scheduled-sends] process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
