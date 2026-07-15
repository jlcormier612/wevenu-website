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
import { sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { translateEmailFailure, translateSmsFailure } from "@/lib/communication/failure-messages";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import { isEnrollmentSequencePaused } from "@/lib/message-sequences/repository";
import { sendMessage as sendLegacyMessage } from "@/lib/messaging/repository";
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

// Communication Platform — Release Readiness, Release Blocker #1.
//
// This function always records a send in `conversation_messages` (correct
// — Relationship-anchored Conversation is the canonical model). But every
// real venue today still has conversation_experience_enabled = false, and
// neither the coordinator's legacy Messages tab nor the couple's portal
// (both unconditionally reading the two pre-Conversation tables) ever look
// at conversation_messages — so a real, sent Automation message was
// reaching nobody. Mirrors into the legacy lib/messaging system (the same
// insert a coordinator's own manual send already uses) whenever a venue is
// still on the legacy experience, so the send is visible somewhere.
//
// Deliberately bounded, not a general solution: only fires for `email`
// (sendMessage's own thread/message shape is email-only — SMS was never a
// first-class legacy-system channel, confirmed by its absence from
// lib/messaging entirely) and only when the relationship still resolves to
// a Lead (Sequences are the pre-booking "Sales Series" capability today,
// per lib/message-sequences' own migration comment — a Client/couple-
// portal equivalent would need a second, admin-client-safe insert path
// into couple_messages that doesn't exist yet, and is named honestly here
// as a real, remaining gap rather than guessed at).
async function mirrorToLegacyIfNeeded(
  supabase: ReturnType<typeof createAdminClient>,
  msg: ScheduledMessage,
  contactEmail: string,
  resolvedSubject: string,
  resolvedBody: string,
  providerId: string | undefined,
): Promise<void> {
  if (msg.channel !== "email") return;
  try {
    const { data: venue } = await supabase.from("venues")
      .select("conversation_experience_enabled").eq("id", msg.venueId).maybeSingle<{ conversation_experience_enabled: boolean }>();
    if (venue?.conversation_experience_enabled) return; // new experience already owns visibility

    const { data: lead } = await supabase.from("leads")
      .select("id").eq("relationship_id", msg.relationshipId).maybeSingle<{ id: string }>();
    if (!lead) return; // not a Lead (already a Client, or no match) — known, named gap, not mirrored

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendLegacyMessage(supabase as any, msg.venueId, "lead", lead.id, null, null, {
      toEmail: contactEmail, toName: "", subject: resolvedSubject, body: resolvedBody,
    }, providerId ?? null, "accepted");
  } catch (err) {
    // Mirroring must never fail the actual send it's mirroring.
    console.error("mirrorToLegacyIfNeeded failed:", err);
  }
}

async function processOne(supabase: ReturnType<typeof createAdminClient>, msg: ScheduledMessage): Promise<{ ok: boolean; error?: string }> {
  const ctx = await repo.getMergeContextForRelationship(supabase, msg.venueId, msg.relationshipId);
  if (!ctx) return { ok: false, error: "Couldn't find who this message belongs to." };
  const contact = await repo.getRecipientContactForRelationship(supabase, msg.relationshipId);

  const mergeData = buildMergeData(ctx);
  const resolvedBody = mergeContent(msg.body, mergeData);

  let providerId: string | undefined;

  if (msg.channel === "email") {
    if (!contact.email) return { ok: false, error: "No email address on file for this contact." };
    const resolvedSubject = mergeContent(msg.emailSubject ?? "", mergeData);
    const result = await sendEmail({ to: contact.email, subject: resolvedSubject, text: resolvedBody });
    if (!result.ok) return { ok: false, error: translateEmailFailure(result.message) };
    providerId = result.providerId;
    await mirrorToLegacyIfNeeded(supabase, msg, contact.email, resolvedSubject, resolvedBody, providerId);
  } else {
    if (!contact.phone) return { ok: false, error: "No phone number on file for this contact." };
    const e164 = toE164(contact.phone);
    if (!e164) return { ok: false, error: "The phone number on file isn't valid." };
    const result = await sendSms({ to: e164, body: resolvedBody });
    if (!result.ok) return { ok: false, error: translateSmsFailure(result.message) };
    providerId = result.providerId;
  }

  const conversationId = await findOrCreateConversation(supabase, msg.venueId, msg.relationshipId);
  if (conversationId) {
    // touch_conversation_on_message already updates last_message_at /
    // venue_unread on insert — no manual follow-up update needed here,
    // same as the SMS inbound webhook.
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      venue_id: msg.venueId,
      sender_type: "venue_staff",
      channel: msg.channel,
      body: resolvedBody,
      provider_id: providerId ?? null,
      status: "accepted",
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
