/**
 * /api/notifications/process
 *
 * Notification delivery engine endpoint. Processes pending reminders in batches of 50.
 *
 * GET  — called by Vercel cron (every 30 minutes per vercel.json)
 *         Authorization: Bearer {CRON_SECRET} (set in Vercel env)
 *
 * POST — called by Settings UI manual trigger
 *         Authorization: x-notifications-secret: {NOTIFICATIONS_SECRET}
 *
 * In development: both methods work without any secret configured.
 */

import { NextResponse } from "next/server";

import { processEscalations, processReminders } from "@/lib/notifications/engine";
import type { ProcessResult } from "@/lib/notifications/types";

function mergeResults(a: ProcessResult, b: ProcessResult): ProcessResult {
  return {
    processed: a.processed + b.processed,
    sent: a.sent + b.sent,
    failed: a.failed + b.failed,
    skipped: a.skipped + b.skipped,
    errors: [...a.errors, ...b.errors],
  };
}

function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;  // dev: no secret configured
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function isManualAuthorized(request: Request): boolean {
  const secret = process.env.NOTIFICATIONS_SECRET;
  if (!secret) return true;  // dev: no secret configured
  return request.headers.get("x-notifications-secret") === secret;
}

/** GET — Vercel cron trigger (every 30 minutes) */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = mergeResults(await processReminders(), await processEscalations());
    console.log(`[cron] notifications processed: ${result.sent} sent, ${result.failed} failed`);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] notification error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — Settings UI manual trigger */
export async function POST(request: Request) {
  if (!isManualAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = mergeResults(await processReminders(), await processEscalations());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifications] process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
