/**
 * /api/automation/process
 *
 * Automation Engine sweep endpoint — same shape as
 * /api/notifications/process (lib/notifications/engine.ts): processes
 * matching Platform Events against enabled automation rules in batches.
 *
 * GET  — cron trigger (see vercel.json)
 *        Authorization: Bearer {CRON_SECRET}
 *
 * POST — manual trigger (future Settings UI, once one exists)
 *        Authorization: x-automation-secret: {AUTOMATION_SECRET}
 *
 * In development: both methods work without any secret configured.
 */
import { NextResponse } from "next/server";

import { processAutomationEvents } from "@/lib/automation/engine";

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev: no secret configured
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function isManualAuthorized(request: Request): boolean {
  const secret = process.env.AUTOMATION_SECRET;
  if (!secret) return true; // dev: no secret configured
  return request.headers.get("x-automation-secret") === secret;
}

/** GET — cron trigger */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processAutomationEvents();
    console.log(`[cron] automation processed: ${result.executed} executed, ${result.skipped} skipped, ${result.failed} failed`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] automation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — manual trigger */
export async function POST(request: Request) {
  if (!isManualAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processAutomationEvents();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[automation] process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
