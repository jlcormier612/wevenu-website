/**
 * Work Package D7C — scheduled Saved Report delivery. Exact same skeleton
 * as the daily digest (lib/notifications/digest-engine.ts): service-role
 * client (no user session on a cron run), a SECURITY DEFINER "who's due"
 * RPC, a loop with content-hash dedupe, sendEmail(). The one genuinely new
 * piece is the cadence itself (day-of-week, not daily) — this codebase had
 * no existing weekly-cadence primitive to reuse (confirmed by this
 * phase's own research pass).
 */
import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

import { sendEmail } from "@/lib/email/send";
import { resolveDateRange } from "@/lib/reporting/date-range";
import { SAVED_REPORT_PATH_LABEL, type SavedReportPath } from "@/lib/saved-reports/types";
import type { DateRangePreset } from "@/lib/reporting/date-range";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";

type DueRow = {
  schedule_id: string; saved_report_id: string; venue_id: string; recipient_email: string;
  last_sent_hash: string | null; report_name: string; report_path: string; date_preset: string;
  custom_from: string | null; custom_to: string | null;
};

type ScheduleResult = { sent: number; skipped: number; failed: number };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for saved-report schedule engine.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function sendDueSavedReports(): Promise<ScheduleResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { sent: 0, skipped: 0, failed: 0 };
  }
  const supabase = getServiceClient();
  const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday, matches the schedule's own check constraint

  const { data: due } = await supabase.rpc("get_due_saved_report_schedules", { p_day_of_week: dayOfWeek });
  if (!due || !(due as DueRow[]).length) return { sent: 0, skipped: 0, failed: 0 };

  let sent = 0, skipped = 0, failed = 0;

  for (const row of due as DueRow[]) {
    try {
      // Link-based delivery, same shape as the daily digest's own "here's
      // what needs attention, click through" emails — not an inline data
      // dump. This also sidesteps a real constraint: this loop runs as
      // service_role with no user session (a cron tick has no logged-in
      // venue user), and the canonical metric functions/CSV builder all
      // expect getCurrentVenue()'s session-derived venue scoping — reusing
      // them here would need a second, session-less call path. Out of
      // scope for D7C; see the implementation doc's Known Limitations.
      const range = resolveDateRange(
        row.date_preset as DateRangePreset,
        row.custom_from ?? undefined,
        row.custom_to ?? undefined,
      );
      const reportLabel = SAVED_REPORT_PATH_LABEL[row.report_path as SavedReportPath] ?? row.report_path;
      const reportUrl = `${APP_URL}${row.report_path}?range=${row.date_preset}`;

      const hash = crypto.createHash("sha256").update(`${row.saved_report_id}:${range.from}:${range.to}`).digest("hex").slice(0, 16);
      if (hash === row.last_sent_hash) { skipped++; continue; }

      await sendEmail({
        to: row.recipient_email,
        subject: `${row.report_name} — ${range.label}`,
        text: `Your saved report "${row.report_name}" (${reportLabel}) for ${range.label} is ready.\n\nView it here: ${reportUrl}`,
        html: `<p>Your saved report "<strong>${row.report_name}</strong>" (${reportLabel}) for ${range.label} is ready.</p><p><a href="${reportUrl}">View it in Hello to Cheers</a></p>`,
      });

      await supabase.rpc("mark_saved_report_schedule_sent", { p_schedule_id: row.schedule_id, p_hash: hash });
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed };
}
