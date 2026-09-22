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
 *
 * Email: unique primary + partner destinations, each with recipient-specific
 * merge context and assertChannelAllowed. SMS: primary phone only (no partner SMS).
 */
import {
  findOrCreateVenueCoupleConversation,
} from "@/lib/conversations/venue-couple-conversation";
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import { appendEmailSignatureText, emailBrandFromVenue } from "@/lib/email/venue-brand";
import { sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { acceptOutboundEmail, acceptOutboundSms } from "@/lib/conversations/delivery-result";
import { resolveForCustomerSend } from "@/lib/message-templates/merge";
import { isEnrollmentSequencePaused, maybeCompleteEnrollmentAfterSend } from "@/lib/message-sequences/repository";
import { uniqueEmailDestinations } from "@/lib/scheduled-messages/email-destinations";
import { mergeContextForEmailDestination } from "@/lib/scheduled-messages/recipient-merge";
import * as repo from "@/lib/scheduled-messages/repository";
import type { ProcessScheduledResult, ScheduledMessage } from "@/lib/scheduled-messages/types";

async function findOrCreateConversation(
  supabase: ReturnType<typeof createAdminClient>, venueId: string, relationshipId: string,
): Promise<string | null> {
  return findOrCreateVenueCoupleConversation(supabase, venueId, relationshipId);
}

async function processOne(supabase: ReturnType<typeof createAdminClient>, msg: ScheduledMessage): Promise<{ ok: boolean; error?: string }> {
  const baseCtx = await repo.getMergeContextForRelationship(supabase, msg.venueId, msg.relationshipId, {
    tourAppointmentId: msg.mergeTourAppointmentId,
    paymentLineItemId: msg.mergePaymentLineItemId,
    taskName: msg.mergeTaskName,
  });
  if (!baseCtx) return { ok: false, error: "Couldn't find who this message belongs to." };
  const contact = await repo.getRecipientContactForRelationship(supabase, msg.relationshipId);

  if (msg.channel === "email") {
    const destinations = uniqueEmailDestinations(contact);
    if (destinations.length === 0) {
      return { ok: false, error: "No email address on file for this contact." };
    }

    const { assertChannelAllowed } = await import("@/lib/communication/permissions");
    const { data: venue } = await supabase.from("venues")
      .select("name, logo_url, primary_color, email_signature, email, phone")
      .eq("id", msg.venueId)
      .maybeSingle<{
        name: string | null;
        logo_url: string | null;
        primary_color: string | null;
        email_signature: string | null;
        email: string | null;
        phone: string | null;
      }>();
    const brand = emailBrandFromVenue(venue);
    const conversationId = await findOrCreateConversation(supabase, msg.venueId, msg.relationshipId);

    let anySuccess = false;
    const errors: string[] = [];

    for (const dest of destinations) {
      const ctx = mergeContextForEmailDestination(baseCtx, dest.role);
      const resolved = resolveForCustomerSend(msg.body, msg.emailSubject, ctx);
      if (!resolved.ok) {
        errors.push(resolved.message);
        continue;
      }
      if (!resolved.subject) {
        errors.push("An email needs a subject line.");
        continue;
      }

      const allowed = await assertChannelAllowed(supabase, {
        venueId: msg.venueId,
        channel: "email",
        rawAddress: dest.email,
      });
      if (!allowed.ok) {
        errors.push(allowed.message);
        continue;
      }

      const html = wrapConversationMessageHtml(brand, resolved.body);
      const result = await sendEmail({
        to: dest.email,
        subject: resolved.subject,
        text: appendEmailSignatureText(resolved.body, brand),
        html,
        threadId: conversationId ?? undefined,
        replyTo: venue?.email ?? undefined,
      });
      const accepted = acceptOutboundEmail(result);
      if (!accepted.ok) {
        errors.push(accepted.message);
        continue;
      }

      anySuccess = true;
      if (conversationId) {
        await supabase.from("conversation_messages").insert({
          conversation_id: conversationId,
          venue_id: msg.venueId,
          sender_type: "system",
          channel: msg.channel,
          body: resolved.body,
          provider_id: accepted.providerId ?? null,
          provider_account_sid: null,
          status: "accepted",
          channel_metadata: msg.sequenceEnrollmentId
            ? { sequenceEnrollmentId: msg.sequenceEnrollmentId, emailDestinationRole: dest.role }
            : { emailDestinationRole: dest.role },
        });
      }
    }

    if (!anySuccess) {
      return { ok: false, error: errors[0] ?? "Couldn't send this email." };
    }
    if (errors.length > 0) {
      console.error("[scheduled-messages] partial email destination failures", {
        messageId: msg.id,
        errors,
      });
    }
    return { ok: true };
  }

  // SMS — primary phone only; partner SMS is out of scope.
  const resolved = resolveForCustomerSend(msg.body, msg.emailSubject, baseCtx);
  if (!resolved.ok) return { ok: false, error: resolved.message };

  if (!contact.phone) return { ok: false, error: "No phone number on file for this contact." };
  const e164 = toE164(contact.phone);
  if (!e164) return { ok: false, error: "The phone number on file isn't valid." };
  const { assertChannelAllowed } = await import("@/lib/communication/permissions");
  const allowed = await assertChannelAllowed(supabase, {
    venueId: msg.venueId,
    channel: "sms",
    rawAddress: e164,
  });
  if (!allowed.ok) return { ok: false, error: allowed.message };
  const result = await sendSms({ to: e164, body: resolved.body, venueId: msg.venueId });
  const accepted = acceptOutboundSms(result);
  if (!accepted.ok) {
    if (/21610|opted out|unsubscribed/i.test(accepted.message)) {
      const { upsertCommunicationPermission } = await import("@/lib/communication/permissions");
      await upsertCommunicationPermission(supabase, {
        venueId: msg.venueId,
        channel: "sms",
        rawAddress: e164,
        status: "opted_out",
        source: "twilio_send_reject",
        evidence: { message: accepted.message },
        relationshipId: msg.relationshipId,
      });
    }
    return { ok: false, error: accepted.message };
  }

  const conversationId = await findOrCreateConversation(supabase, msg.venueId, msg.relationshipId);
  if (conversationId) {
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      venue_id: msg.venueId,
      sender_type: "system",
      channel: msg.channel,
      body: resolved.body,
      provider_id: accepted.providerId ?? null,
      provider_account_sid: result.ok ? result.providerAccountSid : null,
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
