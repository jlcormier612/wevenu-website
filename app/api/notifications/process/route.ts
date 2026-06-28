/**
 * POST /api/notifications/process
 *
 * Notification delivery engine endpoint.
 * Processes pending task_reminders in batches of 50.
 *
 * Authorization: NOTIFICATIONS_SECRET header (shared secret).
 * Future: called by Vercel cron / Supabase pg_cron on a schedule.
 * Current: also callable from Settings UI (manual trigger).
 *
 * Returns: ProcessResult { processed, sent, failed, skipped, errors }
 */

import { NextResponse } from "next/server";

import { processReminders } from "@/lib/notifications/engine";

export async function POST(request: Request) {
  // Shared-secret guard for production — prevents open invocation.
  // Coordinator trigger from settings uses this same secret (stored in Settings → Notifications).
  const secret = process.env.NOTIFICATIONS_SECRET;
  if (secret) {
    const authHeader = request.headers.get("x-notifications-secret");
    if (authHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processReminders();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifications] process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
