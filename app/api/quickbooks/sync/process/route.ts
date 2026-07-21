/**
 * /api/quickbooks/sync/process
 *
 * QuickBooks sync queue sweep endpoint — same shape as
 * /api/automation/process (lib/automation/engine.ts).
 *
 * GET  — cron trigger (see vercel.json)
 *        Authorization: Bearer {CRON_SECRET}
 *
 * POST — manual trigger (future Settings UI, once one exists)
 *        Authorization: x-quickbooks-sync-secret: {QUICKBOOKS_SYNC_SECRET}
 *
 * In development: both methods work without any secret configured.
 */
import { NextResponse } from "next/server";

import { processQuickBooksSyncQueue } from "@/lib/quickbooks/processor";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev: no secret configured
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function isManualAuthorized(request: Request): boolean {
  const secret = process.env.QUICKBOOKS_SYNC_SECRET;
  if (!secret) return true; // dev: no secret configured
  return request.headers.get("x-quickbooks-sync-secret") === secret;
}

/** GET — cron trigger */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processQuickBooksSyncQueue();
    console.log(`[cron] quickbooks sync processed: ${result.succeeded} succeeded, ${result.failedRetrying} retrying, ${result.deadLettered} dead-lettered, ${result.skipped} skipped`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] quickbooks sync error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — manual trigger */
export async function POST(request: Request) {
  if (!isManualAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processQuickBooksSyncQueue();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[quickbooks] sync process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
