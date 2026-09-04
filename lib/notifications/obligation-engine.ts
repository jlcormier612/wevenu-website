/**
 * Payment/contract reminder processing + overdue/attention detection +
 * venue email dispatch — the client- and venue-facing halves of the
 * "set it and forget it" product promise, both extending the existing
 * task_reminders / venue_notifications tables and the existing cron tick
 * (app/api/notifications/process/route.ts), not a second engine.
 *
 * Uses lib/email/send.ts's sendEmail() (the correct shared path — respects
 * COMMUNICATION_MODE sandbox/disabled, sets reply-to) rather than
 * duplicating lib/notifications/engine.ts's older direct-fetch bypass.
 */
import { createClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/email/send";
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import { appendEmailSignatureText, emailBrandFromVenue } from "@/lib/email/venue-brand";
import { recordExternalClientOutbound } from "@/lib/conversations/record-external-outbound";
import type { ProcessResult } from "@/lib/notifications/types";
import { cadenceIntervalDays, type CadenceLabel } from "@/lib/notifications/obligations";

const BATCH_SIZE = 50;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for obligation engine.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function offsetDatetime(datetimeStr: string, days: number): string {
  const d = new Date(datetimeStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── Client-facing: payment/contract reminder sends + recurrence ────────────

type PaymentReminderRow = {
  id: string; venue_id: string; payment_line_item_id: string; reminder_type: string;
  scheduled_for: string; after_due_recur_interval_days: number | null;
  payment_line_items: {
    id: string; label: string; amount: number; due_date: string | null; status: string; schedule_id: string;
  } | null;
};

type ContractReminderRow = {
  id: string; venue_id: string; contract_id: string; reminder_type: string;
  scheduled_for: string; after_due_recur_interval_days: number | null;
  contracts: { id: string; title: string; status: string; expires_at: string | null; client_id: string | null; sign_token: string } | null;
};

export async function processObligationReminders(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  await processPaymentReminders(supabase, now, result);
  await processContractReminders(supabase, now, result);

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processPaymentReminders(supabase: any, now: string, result: ProcessResult): Promise<void> {
  const { data: reminders, error } = await supabase
    .from("task_reminders")
    .select(`
      id, venue_id, payment_line_item_id, reminder_type, scheduled_for, after_due_recur_interval_days,
      payment_line_items ( id, label, amount, due_date, status, schedule_id )
    `)
    .eq("status", "pending")
    .not("payment_line_item_id", "is", null)
    .lte("scheduled_for", now)
    .order("scheduled_for")
    .limit(BATCH_SIZE);

  if (error) { result.errors.push(`Payment reminder fetch error: ${error.message}`); return; }
  if (!reminders?.length) return;

  for (const reminder of reminders as PaymentReminderRow[]) {
    result.processed++;
    try {
      const item = reminder.payment_line_items;
      if (!item || item.status !== "pending") {
        // Paid, cancelled, or already flipped overdue by the same tick — either
        // way this specific "upcoming" row's job is done; the overdue detector
        // (not this function) owns what happens after the due date.
        await supabase.from("task_reminders").update({ status: "skipped" }).eq("id", reminder.id);
        result.skipped++;
        continue;
      }

      const { data: schedule } = await supabase.from("payment_schedules")
        .select("client_id, event_id").eq("id", item.schedule_id).maybeSingle();
      if (!schedule?.client_id) { result.skipped++; continue; }

      const { data: client } = await supabase.from("clients")
        .select("first_name, partner_first_name, email").eq("id", schedule.client_id).maybeSingle();
      if (!client?.email) { result.skipped++; continue; }

      const { data: venue } = await supabase.from("venues")
        .select("name, logo_url, primary_color, email_signature, email, phone")
        .eq("id", reminder.venue_id)
        .maybeSingle();
      const brand = emailBrandFromVenue(venue);
      const venueName = brand.name;
      const dueLabel = item.due_date
        ? new Date(item.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "soon";
      const amountLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.amount);
      const isOverdueReminder = reminder.reminder_type === "overdue";
      const subject = isOverdueReminder
        ? `Payment overdue: ${item.label} — ${venueName}`
        : `Upcoming payment due ${dueLabel}: ${item.label} — ${venueName}`;
      const text = isOverdueReminder
        ? `Your payment of ${amountLabel} for ${item.label} was due ${dueLabel} and hasn't been received yet. Please reach out to ${venueName} to take care of this.`
        : `This is a reminder that your payment of ${amountLabel} for ${item.label} is due ${dueLabel}.`;

      const html = wrapConversationMessageHtml(brand, text);
      const sendResult = await sendEmail({
        to: client.email,
        subject,
        text: appendEmailSignatureText(text, brand),
        html,
        replyTo: venue?.email ?? undefined,
      });
      if (!sendResult.ok) throw new Error(sendResult.message);

      const providerId = sendResult.method === "resend" ? sendResult.providerId ?? null : null;
      await supabase.from("notification_log").insert({
        venue_id: reminder.venue_id, source_type: "task_reminder", source_id: reminder.id,
        recipient_role: "couple", recipient_email: client.email, channel: "email",
        status: "sent", subject, body_preview: text.slice(0, 500),
        provider_message_id: providerId,
        sent_at: new Date().toISOString(),
      });
      await recordExternalClientOutbound(supabase, {
        venueId: reminder.venue_id,
        clientId: schedule.client_id,
        channel: "email",
        body: text,
        providerId,
        status: "accepted",
        sourceType: "payment_reminder",
        sourceId: reminder.id,
      });
      await supabase.from("task_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", reminder.id);
      result.sent++;

      // Recurrence: only "overdue"-phase rows carry an interval, and only
      // while the item is still genuinely unpaid.
      if (reminder.after_due_recur_interval_days && item.status === "pending") {
        await supabase.from("task_reminders").insert({
          venue_id: reminder.venue_id, payment_line_item_id: item.id,
          reminder_type: "overdue", notify_role: "couple",
          scheduled_for: offsetDatetime(now, reminder.after_due_recur_interval_days),
          after_due_recur_interval_days: reminder.after_due_recur_interval_days,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Payment reminder ${reminder.id}: ${msg}`);
      result.failed++;
      await supabase.from("task_reminders").update({ status: "pending" }).eq("id", reminder.id);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processContractReminders(supabase: any, now: string, result: ProcessResult): Promise<void> {
  const { data: reminders, error } = await supabase
    .from("task_reminders")
    .select(`
      id, venue_id, contract_id, reminder_type, scheduled_for, after_due_recur_interval_days,
      contracts ( id, title, status, expires_at, client_id, sign_token )
    `)
    .eq("status", "pending")
    .not("contract_id", "is", null)
    .lte("scheduled_for", now)
    .order("scheduled_for")
    .limit(BATCH_SIZE);

  if (error) { result.errors.push(`Contract reminder fetch error: ${error.message}`); return; }
  if (!reminders?.length) return;

  for (const reminder of reminders as ContractReminderRow[]) {
    result.processed++;
    try {
      const contract = reminder.contracts;
      if (!contract || contract.status !== "sent") {
        // Signed, cancelled, or expired — nothing left to remind about.
        await supabase.from("task_reminders").update({ status: "skipped" }).eq("id", reminder.id);
        result.skipped++;
        continue;
      }
      if (!contract.client_id) { result.skipped++; continue; }

      const { data: client } = await supabase.from("clients").select("email").eq("id", contract.client_id).maybeSingle();
      if (!client?.email) { result.skipped++; continue; }

      const { data: venue } = await supabase.from("venues")
        .select("name, logo_url, primary_color, email_signature, email, phone")
        .eq("id", reminder.venue_id)
        .maybeSingle();
      const brand = emailBrandFromVenue(venue);
      const venueName = brand.name;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const signUrl = `${baseUrl}/sign/${contract.sign_token}`;
      const subject = `Please sign: ${contract.title} — ${venueName}`;
      const text = `${venueName} is waiting on your signature for "${contract.title}". You can review and sign here: ${signUrl}`;

      const html = wrapConversationMessageHtml(brand, text);
      const sendResult = await sendEmail({
        to: client.email,
        subject,
        text: appendEmailSignatureText(text, brand),
        html,
        replyTo: venue?.email ?? undefined,
      });
      if (!sendResult.ok) throw new Error(sendResult.message);

      const providerId = sendResult.method === "resend" ? sendResult.providerId ?? null : null;
      await supabase.from("notification_log").insert({
        venue_id: reminder.venue_id, source_type: "task_reminder", source_id: reminder.id,
        recipient_role: "couple", recipient_email: client.email, channel: "email",
        status: "sent", subject, body_preview: text.slice(0, 500),
        provider_message_id: providerId,
        sent_at: new Date().toISOString(),
      });
      await recordExternalClientOutbound(supabase, {
        venueId: reminder.venue_id,
        clientId: contract.client_id,
        channel: "email",
        body: text,
        providerId,
        status: "accepted",
        sourceType: "contract_reminder",
        sourceId: reminder.id,
      });
      await supabase.from("task_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", reminder.id);
      result.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Contract reminder ${reminder.id}: ${msg}`);
      result.failed++;
      await supabase.from("task_reminders").update({ status: "pending" }).eq("id", reminder.id);
    }
  }
}

// ── Overdue / attention detection — fires the venue notification + first recurring reminder ──

export async function processObligationTransitions(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
  const supabase = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Payments: pending -> overdue. The status flip itself is the idempotency
  // guard — a row only matches this query once, the moment it crosses.
  const { data: overdueItems, error: paymentError } = await supabase
    .from("payment_line_items")
    .select("id, venue_id, schedule_id, label, amount, due_date, payment_schedules ( event_id )")
    .eq("status", "pending")
    .lt("due_date", today)
    .limit(BATCH_SIZE);

  if (paymentError) { result.errors.push(`Overdue payment fetch error: ${paymentError.message}`); }

  for (const item of (overdueItems ?? []) as unknown as {
    id: string; venue_id: string; schedule_id: string; label: string; amount: number; due_date: string;
    payment_schedules: { event_id: string | null }[] | { event_id: string | null } | null;
  }[]) {
    result.processed++;
    try {
      await supabase.from("payment_line_items").update({ status: "overdue", updated_at: new Date().toISOString() }).eq("id", item.id);

      const scheduleEventId = Array.isArray(item.payment_schedules)
        ? item.payment_schedules[0]?.event_id ?? null
        : item.payment_schedules?.event_id ?? null;
      const amountLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.amount);
      const { error: notifyError } = await supabase.rpc("create_venue_notification", {
        p_venue_id: item.venue_id,
        p_event_id: scheduleEventId,
        p_type: "payment_overdue",
        p_title: "Payment overdue",
        p_body: `${item.label} (${amountLabel}) was due ${new Date(item.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} and hasn't been received.`,
        p_link: "/payments",
        p_emoji: "⏰",
      });
      if (notifyError) throw new Error(notifyError.message);

      // First recurring client reminder for the after-due phase, per the
      // venue's cadence. If cadence is "none", no interval — no reminder.
      const { data: cadenceRow } = await supabase.from("venue_reminder_cadence")
        .select("payment_after_due_cadence").eq("venue_id", item.venue_id).maybeSingle();
      const cadenceLabel = (cadenceRow?.payment_after_due_cadence ?? "daily") as CadenceLabel;
      const interval = cadenceIntervalDays(cadenceLabel);
      if (interval) {
        await supabase.from("task_reminders").insert({
          venue_id: item.venue_id, payment_line_item_id: item.id,
          reminder_type: "overdue", notify_role: "couple",
          scheduled_for: new Date().toISOString(),
          after_due_recur_interval_days: interval,
        });
      }
      result.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Overdue payment ${item.id}: ${msg}`);
      result.failed++;
    }
  }

  // Contracts: sent + unsigned + expires within 3 days (or already expired).
  // attention_notified_at is the idempotency guard — fires exactly once.
  const attentionThreshold = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const { data: attentionContracts, error: contractError } = await supabase
    .from("contracts")
    .select("id, venue_id, event_id, title, expires_at")
    .eq("status", "sent")
    .is("attention_notified_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", attentionThreshold)
    .limit(BATCH_SIZE);

  if (contractError) { result.errors.push(`Contract attention fetch error: ${contractError.message}`); }

  for (const contract of (attentionContracts ?? []) as { id: string; venue_id: string; event_id: string | null; title: string; expires_at: string }[]) {
    result.processed++;
    try {
      const expired = contract.expires_at < today;
      const { error: notifyError } = await supabase.rpc("create_venue_notification", {
        p_venue_id: contract.venue_id,
        p_event_id: contract.event_id,
        p_type: "contract_requires_attention",
        p_title: expired ? "Contract expired unsigned" : "Contract needs a signature soon",
        p_body: expired
          ? `"${contract.title}" expired on ${new Date(contract.expires_at + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} without a signature.`
          : `"${contract.title}" is due to expire on ${new Date(contract.expires_at + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })} and hasn't been signed yet.`,
        p_link: `/contracts/${contract.id}`,
        p_emoji: "✍️",
      });
      if (notifyError) throw new Error(notifyError.message);

      await supabase.from("contracts").update({ attention_notified_at: new Date().toISOString() }).eq("id", contract.id);
      result.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Contract attention ${contract.id}: ${msg}`);
      result.failed++;
    }
  }

  return result;
}

// ── Venue-facing: dispatch real emails for preference-enabled notifications ──

export async function processVenueNotificationEmails(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
  const supabase = getServiceClient();

  const { data: rows, error } = await supabase
    .from("venue_notifications")
    .select("id, venue_id, type, title, body, link")
    .eq("needs_email", true)
    .is("emailed_at", null)
    .limit(BATCH_SIZE);

  if (error) { result.errors.push(`Venue notification fetch error: ${error.message}`); return result; }
  if (!rows?.length) return result;

  for (const row of rows as { id: string; venue_id: string; type: string; title: string; body: string | null; link: string | null }[]) {
    result.processed++;
    try {
      const { data: venue } = await supabase.from("venues").select("email, name").eq("id", row.venue_id).maybeSingle();
      if (!venue?.email) {
        // Nothing to email — mark done so this row doesn't get retried forever.
        await supabase.from("venue_notifications").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
        result.skipped++;
        continue;
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const linkLine = row.link ? `\n\n${baseUrl}${row.link}` : "";
      const text = `${row.body ?? ""}${linkLine}`;

      const sendResult = await sendEmail({ to: venue.email, subject: row.title, text });
      if (!sendResult.ok) throw new Error(sendResult.message);

      await supabase.from("notification_log").insert({
        venue_id: row.venue_id, source_type: "system", source_id: row.id,
        recipient_role: "coordinator", recipient_email: venue.email, channel: "email",
        status: "sent", subject: row.title, body_preview: text.slice(0, 500),
        provider_message_id: sendResult.method === "resend" ? sendResult.providerId ?? null : null,
        sent_at: new Date().toISOString(),
      });
      await supabase.from("venue_notifications").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
      result.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Venue notification ${row.id}: ${msg}`);
      result.failed++;
      // Left with emailed_at still null — retried next tick, matching the
      // reminder engine's own retry-by-leaving-pending pattern.
    }
  }

  return result;
}
