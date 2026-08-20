/**
 * /api/facebook/sync/process — Facebook Lead Ads queue sweep, same shape
 * as /api/quickbooks/sync/process.
 *
 * GET  — cron trigger (see vercel.json), Authorization: Bearer {CRON_SECRET}
 * POST — manual trigger, x-facebook-sync-secret: {FACEBOOK_SYNC_SECRET}
 * In development: both work without any secret configured.
 */
import { NextResponse } from "next/server";

import { processFacebookLeadQueue } from "@/lib/facebook/processor";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function isManualAuthorized(request: Request): boolean {
  const secret = process.env.FACEBOOK_SYNC_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-facebook-sync-secret") === secret;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await processFacebookLeadQueue();
    console.log(`[cron] facebook lead queue processed: ${result.succeeded} succeeded, ${result.failedRetrying} retrying, ${result.deadLettered} dead-lettered, ${result.skipped} skipped`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] facebook sync error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isManualAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await processFacebookLeadQueue();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
