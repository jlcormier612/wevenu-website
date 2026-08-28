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

import { cronUnauthorizedResponse, isCronAuthorized, isManualSecretAuthorized } from "@/lib/auth/cron-auth";
import { processEscalations, processReminders } from "@/lib/notifications/engine";
import {
  processObligationReminders,
  processObligationTransitions,
  processVenueNotificationEmails,
} from "@/lib/notifications/obligation-engine";
import type { ProcessResult } from "@/lib/notifications/types";

function mergeResults(...results: ProcessResult[]): ProcessResult {
  return results.reduce((acc, r) => ({
    processed: acc.processed + r.processed,
    sent: acc.sent + r.sent,
    failed: acc.failed + r.failed,
    skipped: acc.skipped + r.skipped,
    errors: [...acc.errors, ...r.errors],
  }), { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] });
}

/**
 * Order matters: transitions (overdue/attention detection) run first so a
 * payment/contract that just crossed its threshold gets its first
 * after-due reminder created in this same tick, then reminders/venue
 * emails run and can pick that row straight up rather than waiting a
 * whole cycle.
 */
async function runAllProcessors(): Promise<ProcessResult> {
  const transitions = await processObligationTransitions();
  const reminders = await processReminders();
  const obligationReminders = await processObligationReminders();
  const escalations = await processEscalations();
  const venueEmails = await processVenueNotificationEmails();
  return mergeResults(transitions, reminders, obligationReminders, escalations, venueEmails);
}

/** GET — Vercel cron trigger (every 30 minutes) */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }
  try {
    const result = await runAllProcessors();
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
  if (!isManualSecretAuthorized(request, "x-notifications-secret", "NOTIFICATIONS_SECRET")) {
    return cronUnauthorizedResponse();
  }
  try {
    const result = await runAllProcessors();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifications] process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
