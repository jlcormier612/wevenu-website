/**
 * Scheduled Sends processor — Communication Platform Phase 2.
 *
 * Runs as a cron job (no user session), so it uses the admin client
 * throughout — same pattern already established for the SMS inbound
 * webhook and the notifications delivery engine. Per run:
 *   1. Fetch due, still-scheduled messages (batch of 50)
 *   2. For each: resolve merge-field context + recipient contact info fresh
 *      (not a schedule-time snapshot — see the migration's own comment)
 *   3. Send via the real channel (Resend for email, Twilio for SMS)
 *   4. On success, record it in the relationship's Conversation so it shows
 *      up in the same unified timeline as any other message — a scheduled
 *      send isn't a separate kind of thing once it's actually gone out
 *   5. Mark sent or failed
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import { sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { translateEmailFailure, translateSmsFailure } from "@/lib/communication/failure-messages";
import { resolveForCustomerSend } from "@/lib/message-templates/merge";
import { isEnrollmentSequencePaused, maybeCompleteEnrollmentAfterSend } from "@/lib/message-sequences/repository";
import * as repo from "@/lib/scheduled-messages/repository";
import type { ProcessScheduledResult, ScheduledMessage } from "@/lib/scheduled-messages/types";

async function findOrCreateConversation(
  supabase: ReturnType<typeof createAdminClient>, venueId: string, relationshipId: string,
): Promise<string | null> {
  const { data: existing } = await supabase.from("conversations")
    .select("id").eq("relationship_id", relationshipId).maybeSingle<{ id: string }>();
  if (existing) return existing.id;

  const { data: created, error } = await supabase.from("conversations")
    .insert({ venue_id: venueId, relationship_id: relationshipId })
    .select("id").single<{ id: string }>();
  if (error) return null;
  return created.id;
}

async function processOne(supabase: ReturnType<typeof createAdminClient>, msg: ScheduledMessage): Promise<{ ok: boolean; error?: string }> {
  const ctx = await repo.getMergeContextForRelationship(supabase, msg.venueId, msg.relationshipId, {
    tourAppointmentId: msg.mergeTourAppointmentId,
    paymentLineItemId: msg.mergePaymentLineItemId,
    taskName: msg.mergeTaskName,
  });
  if (!ctx) return { ok: false, error: "Couldn't find who this message belongs to." };
  const contact = await repo.getRecipientContactForRelationship(supabase, msg.relationshipId);

  // Content is stored with raw {{tokens}}; resolve fresh at send time so a
  // rescheduled tour or edited payment is never sent stale.
  const resolved = resolveForCustomerSend(msg.body, msg.emailSubject, ctx);
  if (!resolved.ok) return { ok: false, error: resolved.message };

  let providerId: string | undefined;

  if (msg.channel === "email") {
    if (!contact.email) return { ok: false, error: "No email address on file for this contact." };
    if (!resolved.subject) return { ok: false, error: "An email needs a subject line." };
    // Merge already resolved above. Brand with live venue identity at send time.
    const { data: venue } = await supabase.from("venues")
      .select("name, logo_url, primary_color")
      .eq("id", msg.venueId)
      .maybeSingle<{ name: string | null; logo_url: string | null; primary_color: string | null }>();
    const brand = {
      name: venue?.name ?? "Your venue",
      logoUrl: venue?.logo_url,
      primaryColor: venue?.primary_color ?? "#5D6F5D",
    };
    const html = wrapConversationMessageHtml(brand, resolved.body);
    const result = await sendEmail({ to: contact.email, subject: resolved.subject, text: resolved.body, html });
    if (!result.ok) return { ok: false, error: translateEmailFailure(result.message) };
    providerId = result.providerId;
  } else {
    if (!contact.phone) return { ok: false, error: "No phone number on file for this contact." };
    const e164 = toE164(contact.phone);
    if (!e164) return { ok: false, error: "The phone number on file isn't valid." };
    const result = await sendSms({ to: e164, body: resolved.body });
    if (!result.ok) return { ok: false, error: translateSmsFailure(result.message) };
    providerId = result.providerId;
  }

  const conversationId = await findOrCreateConversation(supabase, msg.venueId, msg.relationshipId);
  if (conversationId) {
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      venue_id: msg.venueId,
      sender_type: "system",
      channel: msg.channel,
      body: resolved.body,
      provider_id: providerId ?? null,
      status: "accepted",
      channel_metadata: msg.sequenceEnrollmentId ? { sequenceEnrollmentId: msg.sequenceEnrollmentId } : null,
    });
  }

  return { ok: true };
}

export async function processDueScheduledMessages(): Promise<ProcessScheduledResult> {
  const supabase = createAdminClient();
  const result: ProcessScheduledResult = { processed: 0, sent: 0, failed: 0 };

  const due = await repo.getDueBatch(supabase);
  for (const msg of due) {
    if (msg.sequenceEnrollmentId && await isEnrollmentSequencePaused(supabase, msg.sequenceEnrollmentId)) {
      continue; // paused — leave it scheduled, don't send, don't count as processed
    }
    result.processed += 1;
    try {
      const outcome = await processOne(supabase, msg);
      if (outcome.ok) {
        await repo.markSent(supabase, msg.id);
        result.sent += 1;
        if (msg.sequenceEnrollmentId) {
          await maybeCompleteEnrollmentAfterSend(supabase, msg.venueId, msg.sequenceEnrollmentId)
            .catch((e) => console.error("Enrollment complete after final step failed:", e));
        }
      } else {
        await repo.markFailed(supabase, msg.id, outcome.error ?? "Unknown error.");
        result.failed += 1;
      }
    } catch (err) {
      await repo.markFailed(supabase, msg.id, err instanceof Error ? err.message : "Unknown error.");
      result.failed += 1;
    }
  }

  return result;
}
