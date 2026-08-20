/**
 * Conversation application service — Program 2, Phase 2A.
 * Components and server actions call here — never the repository directly.
 * Server-only.
 *
 * Venue resolution happens inside the underlying RPCs
 * (current_user_venue_id()), so unlike lib/leads/service.ts there's no
 * venueId to thread through here.
 */
import { createClient, createVendorClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/conversations/repository";
import {
  notifyCoupleOfVendorPortalMessage,
  notifyCoupleOfVenuePortalMessage,
  notifyVendorOfCouplePortalMessage,
  notifyVendorOfVenuePortalMessage,
  notifyVenueOfVendorPortalMessage,
} from "@/lib/conversations/notify";
import { dismissOrphanMessageNotificationsForConversation } from "@/lib/vendor-notifications/reconcile-message-notifications";
import { getVendorEvents } from "@/lib/vendor-events/service";
import type {
  ConversationDetail,
  ConversationSummary,
  PortalConversationResult,
  PortalCoupleVendorConversationResult,
  PortalCoupleVendorConversationSummary,
  SendMessageResult,
  VendorConversationResult,
  VendorConversationSummary,
  VendorRollupConversation,
} from "@/lib/conversations/types";
import { sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { sendEmail } from "@/lib/email/send";
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import { translateEmailFailure, translateSmsFailure } from "@/lib/communication/failure-messages";
import { extractTokens, resolveForCustomerSend } from "@/lib/message-templates/merge";
import { getMergeContextForRelationship } from "@/lib/scheduled-messages/repository";
import { getCurrentStaffMember } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";

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
  hasAttachment = false,
): Promise<SendMessageResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  // An attachment-only message ("here's the floor plan," no text) is only
  // meaningful on record-only channels — email/SMS attachments aren't
  // actually delivered by either provider integration in this pass, so an
  // empty body there would silently send nothing.
  const attachmentOnlyAllowed = hasAttachment && (channel === "portal" || channel === "internal_note");
  if (!body.trim() && !attachmentOnlyAllowed) return { ok: false, message: "Message can't be empty." };
  const supabase = await createClient();
  let trimmed = body.trim();
  let subject = emailSubject?.trim();

  // Work Package D8 — the same principle D6 already applied to Contracts:
  // never let a literal {{merge_field}} reach a real client. Picking a
  // Message Template into this compose box previously loaded raw,
  // unresolved tokens straight into the textarea — Send Now shipped them
  // verbatim, since only the separate Scheduled Sends path
  // (lib/scheduled-messages/processor.ts) ever called mergeContent. Every
  // send-capable channel goes through this one function, so resolving here
  // covers all of them at once, regardless of what UI composed the message.
  //
  // Starter Message Library: tour/payment tokens resolve from live authoritative
  // rows; unresolved tokens after merge fail the send (customer-safe).
  if (extractTokens(trimmed).length > 0 || (subject && extractTokens(subject).length > 0)) {
    const [venue, relationshipId] = await Promise.all([
      getCurrentVenue(),
      repo.getRelationshipIdForConversation(supabase, conversationId),
    ]);
    const staff = venue ? await getCurrentStaffMember(venue.id) : null;
    const ctx = venue && relationshipId
      ? await getMergeContextForRelationship(supabase, venue.id, relationshipId, {
          coordinatorName: staff?.name ?? null,
        })
      : null;
    if (!ctx) {
      return {
        ok: false,
        message: "This message still has fill-in details that need a client conversation context before sending.",
      };
    }
    const resolved = resolveForCustomerSend(trimmed, subject, ctx);
    if (!resolved.ok) return { ok: false, message: resolved.message };
    trimmed = resolved.body;
    subject = resolved.subject ?? undefined;
  }

  // Email and SMS are the two channels with a real external send behind
  // them — attempt the actual send *before* recording it, so the
  // conversation transcript never shows a message as sent when it never
  // left Hello to Cheers. Every other channel here (portal, internal_note,
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
    if (!subject) {
      return { ok: false, message: "An email needs a subject line." };
    }
    const email = await repo.getConversationRecipientEmail(supabase, conversationId);
    if (!email) {
      return { ok: false, message: "This client has no email address on file — add one to their record to send an email." };
    }
    // Merge resolution already ran above when tokens were present. Wrap the
    // resolved plain-text body in the shared venue-brand shell; keep `text`
    // as the plain-text fallback (Workstream A).
    const venue = await getCurrentVenue();
    const brand = {
      name: venue?.name ?? "Your venue",
      logoUrl: venue?.logoUrl,
      primaryColor: venue?.primaryColor ?? "#5D6F5D",
    };
    const html = wrapConversationMessageHtml(brand, trimmed);
    const emailResult = await sendEmail({ to: email, subject, text: trimmed, html });
    if (!emailResult.ok) return { ok: false, message: translateEmailFailure(emailResult.message) };
    providerId = emailResult.providerId;
    status = "accepted";
  }

  const result = await repo.sendConversationMessage(supabase, conversationId, trimmed, channel, providerId, status);
  if (!result.ok) return { ok: false, message: result.error ?? "Could not send message." };

  // Portal-only: email/SMS already notified the counterparty via the
  // provider send above. Route by thread kind — each helper no-ops when
  // the conversation is the wrong kind.
  if (channel === "portal") {
    notifyVendorOfVenuePortalMessage(conversationId, trimmed);
    notifyCoupleOfVenuePortalMessage(conversationId, trimmed);
  }

  return { ok: true, messageId: result.messageId! };
}

/** RC2 — every attachment across a Conversation, for the Relationship Context Panel. */
export async function getConversationAttachments(conversationId: string) {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  return repo.getConversationAttachments(supabase, conversationId);
}

/** RC2 — attaches an already-uploaded file to a message the caller just sent. */
export async function addConversationMessageAttachment(
  messageId: string,
  file: { url: string; name: string; size?: number | null; mimeType?: string | null },
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const result = await repo.addConversationMessageAttachment(supabase, messageId, file);
  if (!result.ok) return { ok: false, message: result.error ?? "Could not attach file." };
  return { ok: true };
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

export async function sendPortalConversationMessage(
  token: string,
  body: string,
  hasAttachment = false,
): Promise<SendMessageResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!body.trim() && !hasAttachment) return { ok: false, message: "Message can't be empty." };
  const supabase = await createClient();
  const result = await repo.sendPortalConversationMessage(supabase, token, body.trim(), hasAttachment);
  if (!result.ok) return { ok: false, message: result.error ?? "Could not send message." };
  return { ok: true, messageId: result.messageId! };
}

/** RC2 — attaches an already-uploaded file to a message the couple just sent. */
export async function addPortalConversationMessageAttachment(
  token: string,
  messageId: string,
  file: { url: string; name: string; size?: number | null; mimeType?: string | null },
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const result = await repo.addPortalConversationMessageAttachment(supabase, token, messageId, file);
  if (!result.ok) return { ok: false, message: result.error ?? "Could not attach file." };
  return { ok: true };
}

// ── RC2, Milestone 3 — vendor conversations (event-anchored) ────────────────

/** Venue side — resolves an assignment's Conversation id for the "Message [Vendor]" panel. */
export async function getConversationIdForEventVendorAssignment(assignmentId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  return repo.getConversationIdForEventVendorAssignment(supabase, assignmentId);
}

/** Venue side — the Vendor detail page's conversation history rollup. */
export async function getVendorRelationshipRollup(vendorRelationshipId: string): Promise<VendorRollupConversation[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  return repo.getVendorRelationshipRollup(supabase, vendorRelationshipId);
}

/** Vendor side — the vendor portal's event-grouped Messages inbox. */
export async function getVendorConversationInbox(): Promise<{ conversations: VendorConversationSummary[]; totalUnread: number }> {
  if (!isSupabaseConfigured) return { conversations: [], totalUnread: 0 };
  const supabase = await createVendorClient();
  return repo.getVendorConversationInbox(supabase);
}

export async function getVendorConversation(conversationId: string): Promise<VendorConversationResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createVendorClient();
  const conversation = await repo.getVendorConversation(supabase, conversationId);
  if (!conversation) return { ok: false, message: "Conversation not found." };

  // Thread header needs event / venue / couple labels. Inbox + vendor events
  // are the same sources Home and the Messages list already use (RLS-safe).
  const [inbox, events] = await Promise.all([
    repo.getVendorConversationInbox(supabase),
    getVendorEvents(),
  ]);
  const summary = inbox.conversations.find((c) => c.conversationId === conversationId);
  const event = events.find((e) => e.eventId === summary?.eventId);

  return {
    ok: true,
    conversation: {
      ...conversation,
      conversationKind: summary?.conversationKind ?? conversation.conversationKind,
      eventName: summary?.eventName ?? null,
      venueName: summary?.venueName ?? event?.venueName ?? null,
      coupleName: summary?.coupleName ?? null,
      counterpartyLabel: summary?.counterpartyLabel ?? conversation.counterpartyLabel,
    },
  };
}

/**
 * When a stored deep link points at a conversation that was CASCADE-deleted
 * (e.g. assignment recreated), recover the live twin for the same event +
 * kind from the vendor's notification metadata + inbox.
 *
 * Clears orphan new_message notifications for the dead id: rewrite onto a
 * twin that still has messages (keep unread only if twin.contactUnread > 0),
 * otherwise mark read so the bell can't advertise a vanished thread.
 */
export async function recoverVendorConversationId(
  deadConversationId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createVendorClient();

  const { data: note } = await supabase
    .from("vendor_notifications")
    .select("event_id, title, link")
    .eq("type", "new_message")
    .like("link", `%${deadConversationId}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ event_id: string | null; title: string; link: string | null }>();

  const { conversations } = await repo.getVendorConversationInbox(supabase);
  const wantCouple = note ? /couple/i.test(note.title) : false;
  const match = note?.event_id
    ? conversations.find(
        (c) =>
          c.eventId === note.event_id &&
          (wantCouple
            ? c.conversationKind === "couple_vendor"
            : c.conversationKind === "venue_vendor"),
      )
    : undefined;

  const twinHasMessages = Boolean(match?.lastMessageAt || match?.latestMessage);
  const fallbackLink = match
    ? `/vendor/messages/${match.conversationId}`
    : "/vendor/messages";

  const keepUnread = Boolean(twinHasMessages && match && match.contactUnread > 0);
  await dismissOrphanMessageNotificationsForConversation(
    supabase,
    deadConversationId,
    fallbackLink,
    { markRead: !keepUnread },
  );

  return match?.conversationId ?? null;
}

export async function sendVendorConversationMessage(
  conversationId: string,
  body: string,
  hasAttachment = false,
): Promise<SendMessageResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!body.trim() && !hasAttachment) return { ok: false, message: "Message can't be empty." };
  const supabase = await createVendorClient();
  const trimmed = body.trim();
  const result = await repo.sendVendorConversationMessage(supabase, conversationId, trimmed, hasAttachment);
  if (!result.ok) return { ok: false, message: result.error ?? "Could not send message." };

  // Route notify by thread kind — venue ops vs couple client thread.
  // Use inbox (no read-side effects) rather than getVendorConversation.
  const inbox = await repo.getVendorConversationInbox(supabase);
  const summary = inbox.conversations.find((c) => c.conversationId === conversationId);
  if (summary?.conversationKind === "couple_vendor") {
    notifyCoupleOfVendorPortalMessage(conversationId, trimmed);
  } else {
    notifyVenueOfVendorPortalMessage(conversationId, trimmed);
  }
  return { ok: true, messageId: result.messageId! };
}

/** Sprint 1 — attaches an already-uploaded file to a message the vendor just sent. */
export async function addVendorConversationMessageAttachment(
  messageId: string,
  file: { url: string; name: string; size?: number | null; mimeType?: string | null },
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createVendorClient();
  const result = await repo.addVendorConversationMessageAttachment(supabase, messageId, file);
  if (!result.ok) return { ok: false, message: result.error ?? "Could not attach file." };
  return { ok: true };
}

// ── Couple ↔ vendor (portal) ──────────────────────────────────────────────────

export async function getPortalCoupleVendorConversations(
  token: string,
  clientId: string,
): Promise<{ conversations: PortalCoupleVendorConversationSummary[]; totalUnread: number }> {
  if (!isSupabaseConfigured) return { conversations: [], totalUnread: 0 };
  const supabase = await createClient();
  return repo.getPortalCoupleVendorConversations(supabase, token, clientId);
}

export async function getPortalCoupleVendorConversation(
  token: string,
  clientId: string,
  conversationId: string,
): Promise<PortalCoupleVendorConversationResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const result = await repo.getPortalCoupleVendorConversation(supabase, token, clientId, conversationId);
  if ("error" in result) return { ok: false, message: result.error };
  return { ok: true, conversation: result };
}

export async function sendPortalCoupleVendorMessage(
  token: string,
  clientId: string,
  conversationId: string,
  body: string,
  hasAttachment = false,
): Promise<SendMessageResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!body.trim() && !hasAttachment) return { ok: false, message: "Message can't be empty." };
  const supabase = await createClient();
  const trimmed = body.trim();
  const result = await repo.sendPortalCoupleVendorMessage(
    supabase, token, clientId, conversationId, trimmed, hasAttachment,
  );
  if (!result.ok) return { ok: false, message: result.error ?? "Could not send message." };
  notifyVendorOfCouplePortalMessage(conversationId, trimmed);
  return { ok: true, messageId: result.messageId! };
}
