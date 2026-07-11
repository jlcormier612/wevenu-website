/**
 * Notification Delivery Engine — Sprint 44
 *
 * Channel-agnostic: email | sms | in_app | push
 * Sprint 44 implements: email only via Resend
 *
 * Called by:
 *   - POST /api/notifications/process (manual trigger, future cron target)
 *   - Future: Supabase pg_cron or Vercel cron job
 *
 * Per-run behavior:
 *   1. Query task_reminders WHERE status='pending' AND scheduled_for <= now()
 *   2. For each reminder: fetch context → determine channel → build message → send → log → update status
 *   3. Recurring: if reminder_interval_days set and task still pending, create next reminder
 *   4. Return ProcessResult summary
 */

import { createClient } from "@supabase/supabase-js";

import { buildReminderEmail } from "@/lib/notifications/templates";
import { determineChannel, type NotificationRole, type ProcessResult } from "@/lib/notifications/types";

const BATCH_SIZE = 50;  // reminders per run

// Use service role for the delivery engine — needs to write notification_log
// bypassing RLS (the engine runs as a system process, not as an authenticated user)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for notification engine.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

export async function processReminders(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // Fetch batch of due reminders (both task and tour reminders)
  const { data: reminders, error } = await supabase
    .from("task_reminders")
    .select(`
      id, venue_id, event_task_id, tour_appointment_id, reminder_type, notify_role, scheduled_for,
      event_tasks (
        id, title, event_id, visibility, owner_type, status, due_date,
        reminder_interval_days,
        event_tasks_event:events ( id, name, event_date, client_id,
          clients ( id, first_name, partner_first_name, email )
        )
      ),
      tour_appointment:tour_appointments (
        id, scheduled_at, duration_minutes, contact_name, contact_email, status
      )
    `)
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for")
    .limit(BATCH_SIZE);

  if (error) { result.errors.push(`Fetch error: ${error.message}`); return result; }
  if (!reminders?.length) return result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const reminder of reminders as unknown as ReminderRow[]) {
    result.processed++;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tourAppt = (reminder as any).tour_appointment;
      const isTourReminder = !!tourAppt || !!(reminder as any).tour_appointment_id;

      const task = isTourReminder ? null : reminder.event_tasks;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = (task as any)?.event_tasks_event;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (event as any)?.clients;

      // Skip if task is already complete or waived
      if (task?.status === "complete" || task?.status === "waived") {
        await supabase.from("task_reminders").update({ status: "skipped" }).eq("id", reminder.id);
        result.skipped++;
        continue;
      }
      // Skip if tour is cancelled
      if (isTourReminder && tourAppt?.status === "cancelled") {
        await supabase.from("task_reminders").update({ status: "skipped" }).eq("id", reminder.id);
        result.skipped++;
        continue;
      }

      if (!isTourReminder && (!event || !task)) { result.skipped++; continue; }

      const role = reminder.notify_role as NotificationRole;
      const channel = determineChannel(role, "task_reminder");

      // Route to appropriate delivery method
      let sent = false;
      let providerMessageId: string | null = null;
      let recipientEmail: string | null = null;
      let subject = "";
      let bodyPreview = "";

      if (channel === "email") {
        // Determine recipient email
        // Determine recipient email
        if (role === "coordinator") {
          const { data: venue } = await supabase.from("venues").select("email").eq("id", reminder.venue_id).maybeSingle<{ email: string | null }>();
          recipientEmail = venue?.email ?? null;
        } else if (role === "couple") {
          recipientEmail = isTourReminder ? (tourAppt?.contact_email ?? null) : (client?.email ?? null);
        }

        if (!recipientEmail) { result.skipped++; continue; }

        // Get portal token for couple links (task reminders only)
        let portalToken: string | undefined;
        if (!isTourReminder && role === "couple" && event?.client_id) {
          const { data: session } = await supabase.from("client_portal_sessions").select("access_token").eq("client_id", event.client_id).eq("venue_id", reminder.venue_id).maybeSingle<{ access_token: string }>();
          portalToken = session?.access_token;
        }

        const { data: venueRow } = await supabase.from("venues").select("name").eq("id", reminder.venue_id).maybeSingle<{ name: string }>();
        const venueName = venueRow?.name ?? "Your Venue";

        let emailContent: { subject: string; html: string; text: string };
        if (isTourReminder && tourAppt) {
          // Tour reminder email
          const tourDate = new Date(tourAppt.scheduled_at);
          const dateStr = tourDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          const timeStr = tourDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const subj = role === "coordinator"
            ? `Tour reminder: ${tourAppt.contact_name ?? "Upcoming tour"} — ${dateStr} at ${timeStr}`
            : `Your tour at ${venueName} is tomorrow — ${dateStr} at ${timeStr}`;
          const body = role === "coordinator"
            ? `You have a venue tour tomorrow at ${timeStr} with ${tourAppt.contact_name ?? "a prospective client"}. Duration: ${tourAppt.duration_minutes} minutes.`
            : `Just a reminder that your tour at ${venueName} is tomorrow at ${timeStr}. We look forward to meeting you!`;
          emailContent = { subject: subj, html: `<p>${body}</p><p>— ${venueName}</p>`, text: body };
        } else {
          // Task reminder email
          const coupleName = [client?.first_name, client?.partner_first_name].filter(Boolean).join(" & ");
          emailContent = buildReminderEmail({
            taskTitle: task!.title,
            eventName: event?.name ?? `${coupleName} — Event`,
            eventDate: event?.event_date ?? "",
            dueDate: task!.due_date,
            role, reminderType: reminder.reminder_type,
            portalToken, venueBaseUrl: getBaseUrl(), venueName,
          });
        }
        subject = emailContent.subject;
        bodyPreview = emailContent.html.replace(/<[^>]+>/g, "").slice(0, 500);

        // Send via Resend REST API
        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>";
        if (apiKey) {
          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: fromEmail, to: recipientEmail, subject: emailContent.subject, html: emailContent.html, text: emailContent.text }),
          });
          if (!resendResponse.ok) {
            const err = await resendResponse.json().catch(() => ({})) as { message?: string };
            throw new Error(err.message ?? `Resend HTTP ${resendResponse.status}`);
          }
          const resendData = await resendResponse.json() as { id?: string };
          providerMessageId = resendData.id ?? null;
          sent = true;
        } else {
          console.log(`[notifications] DEV send to ${recipientEmail}: ${subject}`);
          sent = true;
        }
      } else {
        // SMS / in_app / push — not yet implemented, skip gracefully
        result.skipped++;
        continue;
      }

      if (!sent) { result.failed++; continue; }

      // Log the notification
      await supabase.from("notification_log").insert({
        venue_id: reminder.venue_id,
        source_type: "task_reminder",
        source_id: reminder.id,
        recipient_role: role,
        recipient_email: recipientEmail,
        channel,
        status: "sent",
        subject,
        body_preview: bodyPreview,
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
      });

      // Mark reminder as sent
      await supabase.from("task_reminders")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      // Recurring: if task still pending and interval is set, schedule next reminder
      const intervalDays = !isTourReminder ? (task as ReminderRow["event_tasks"] & { reminder_interval_days?: number })?.reminder_interval_days : null;
      if (intervalDays && task?.status === "pending") {
        const nextDate = new Date(reminder.scheduled_for);
        nextDate.setDate(nextDate.getDate() + intervalDays);
        if (nextDate > new Date()) {
          await supabase.from("task_reminders").insert({
            venue_id: reminder.venue_id,
            event_task_id: reminder.event_task_id,
            reminder_type: reminder.reminder_type,
            notify_role: reminder.notify_role,
            scheduled_for: nextDate.toISOString(),
            status: "pending",
          });
        }
      }

      result.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Reminder ${reminder.id}: ${msg}`);
      result.failed++;

      await supabase.from("task_reminders")
        .update({ status: "pending" })  // keep pending for retry
        .eq("id", reminder.id);

      await supabase.from("notification_log").insert({
        venue_id: reminder.venue_id,
        source_type: "task_reminder",
        source_id: reminder.id,
        recipient_role: reminder.notify_role,
        channel: determineChannel(reminder.notify_role as NotificationRole, "task_reminder"),
        status: "failed",
        error_message: msg,
        sent_at: new Date().toISOString(),
      });
    }
  }

  return result;
}

// Type helpers for the reminder query shape
type ReminderRow = {
  id: string;
  venue_id: string;
  event_task_id: string;
  reminder_type: string;
  notify_role: string;
  scheduled_for: string;
  event_tasks: {
    id: string; title: string; event_id: string;
    visibility: string; owner_type: string; status: string;
    due_date: string;
  } | null;
};
