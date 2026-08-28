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

import { cronUnauthorizedResponse, isCronAuthorized, isManualSecretAuthorized } from "@/lib/auth/cron-auth";
import { processAutomationEvents } from "@/lib/automation/engine";

/** GET — cron trigger */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }
  try {
    const result = await processAutomationEvents();
    console.log(`[cron] automation processed: ${result.executed} executed, ${result.skipped} skipped, ${result.failed} failed | system guarantees: ${result.systemGuarantees.applied} applied, ${result.systemGuarantees.skipped} skipped, ${result.systemGuarantees.failed} failed`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] automation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — manual trigger */
export async function POST(request: Request) {
  if (!isManualSecretAuthorized(request, "x-automation-secret", "AUTOMATION_SECRET")) {
    return cronUnauthorizedResponse();
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
