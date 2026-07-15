/**
 * Conversation application service — Program 2, Phase 2A.
 * Components and server actions call here — never the repository directly.
 * Server-only.
 *
 * Venue resolution happens inside the underlying RPCs
 * (current_user_venue_id()), so unlike lib/leads/service.ts there's no
 * venueId to thread through here.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/conversations/repository";
import type {
  ConversationDetail,
  ConversationSummary,
  PortalConversationResult,
  SendMessageResult,
} from "@/lib/conversations/types";
import { sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { sendEmail } from "@/lib/email/send";
import { translateEmailFailure, translateSmsFailure } from "@/lib/communication/failure-messages";

export async function getConversationInbox(): Promise<{ conversations: ConversationSummary[]; totalUnread: number }> {
  if (!isSupabaseConfigured) return { conversations: [], totalUnread: 0 };
  const supabase = await createClient();
  return repo.getConversationInbox(supabase);
}

export async function getConversation(conversationId: string): Promise<ConversationDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  return repo.getConversation(supabase, conversationId);
}

export async function sendConversationMessage(
  conversationId: string,
  body: string,
  channel = "portal",
  emailSubject?: string,
): Promise<SendMessageResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!body.trim()) return { ok: false, message: "Message can't be empty." };
  const supabase = await createClient();
  const trimmed = body.trim();

  // Email and SMS are the two channels with a real external send behind
  // them — attempt the actual send *before* recording it, so the
  // conversation transcript never shows a message as sent when it never
  // left Wevenu. Every other channel here (portal, internal_note,
  // phone_log, ...) is record-only by nature.
  //
  // Email was corrected 2026-07-14 — it looked identical to sms in the
  // channel dropdown but silently never called Resend; see
  // docs/product-backlog.md "Immediate Email Send in Conversations Isn't
  // Real" for how that was found. conversation_messages has no subject
  // column (true for every channel, not just email) — the subject is used
  // for the real outbound send only, same as Scheduled Sends already does.
  // Communication Trust Experience — capture what the provider actually
  // said (its id, whether it was accepted at all) instead of throwing that
  // answer away the moment the send succeeds. Without a provider_id here,
  // no delivery/open/click/bounce webhook could ever find this row again —
  // see docs/communication-trust-experience.md, Phase 1.
  let providerId: string | undefined;
  let status: string | undefined;
  if (channel === "sms") {
    const phone = await repo.getConversationRecipientPhone(supabase, conversationId);
    const e164 = phone ? toE164(phone) : null;
    if (!e164) {
      return { ok: false, message: "This client has no phone number on file — add one to their record to send a text." };
    }
    const smsResult = await sendSms({ to: e164, body: trimmed });
    if (!smsResult.ok) return { ok: false, message: translateSmsFailure(smsResult.message) };
    providerId = smsResult.providerId;
    status = "accepted";
  } else if (channel === "email") {
    if (!emailSubject?.trim()) {
      return { ok: false, message: "An email needs a subject line." };
    }
    const email = await repo.getConversationRecipientEmail(supabase, conversationId);
    if (!email) {
      return { ok: false, message: "This client has no email address on file — add one to their record to send an email." };
    }
    const emailResult = await sendEmail({ to: email, subject: emailSubject.trim(), text: trimmed });
    if (!emailResult.ok) return { ok: false, message: translateEmailFailure(emailResult.message) };
    providerId = emailResult.providerId;
    status = "accepted";
  }

  const result = await repo.sendConversationMessage(supabase, conversationId, trimmed, channel, providerId, status);
  if (!result.ok) return { ok: false, message: result.error ?? "Could not send message." };
  return { ok: true, messageId: result.messageId! };
}

export async function getConversationIdForRelationship(relationshipId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  return repo.getConversationIdForRelationship(supabase, relationshipId);
}

export async function setConversationAssignedStaff(conversationId: string, staffId: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  await repo.setConversationAssignedStaff(supabase, conversationId, staffId);
}

export async function getConversationUnreadCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  return repo.getConversationUnreadCount(supabase);
}

export async function getPortalConversation(token: string): Promise<PortalConversationResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const result = await repo.getPortalConversation(supabase, token);
  if ("error" in result) return { ok: false, message: result.error };
  return { ok: true, conversation: result };
}

export async function sendPortalConversationMessage(token: string, body: string): Promise<SendMessageResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!body.trim()) return { ok: false, message: "Message can't be empty." };
  const supabase = await createClient();
  const result = await repo.sendPortalConversationMessage(supabase, token, body.trim());
  if (!result.ok) return { ok: false, message: result.error ?? "Could not send message." };
  return { ok: true, messageId: result.messageId! };
}
