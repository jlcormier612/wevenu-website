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

import { cronUnauthorizedResponse, isCronAuthorized, isManualSecretAuthorized } from "@/lib/auth/cron-auth";
import { processDueQuestionnaireScheduledSends } from "@/lib/events/questionnaire-scheduled-send";
import { processDueScheduledMessages } from "@/lib/scheduled-messages/processor";

async function runScheduledProcessors() {
  const messages = await processDueScheduledMessages();
  const questionnaires = await processDueQuestionnaireScheduledSends();
  return { messages, questionnaires };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }
  try {
    const result = await runScheduledProcessors();
    console.log(
      `[cron] scheduled sends processed: messages ${result.messages.sent} sent / ${result.messages.failed} failed; `
      + `questionnaires ${result.questionnaires.sent} sent / ${result.questionnaires.failed} failed`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron] scheduled send error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isManualSecretAuthorized(request, "x-notifications-secret", "NOTIFICATIONS_SECRET")) {
    return cronUnauthorizedResponse();
  }
  try {
    const result = await runScheduledProcessors();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[scheduled-sends] process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
