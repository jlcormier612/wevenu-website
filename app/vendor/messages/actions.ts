"use server";

import { revalidatePath } from "next/cache";

import {
  addVendorConversationMessageAttachment,
  getVendorConversation,
  getVendorConversationInbox,
  sendVendorConversationMessage,
} from "@/lib/conversations/service";
import type { SendMessageResult, VendorConversationResult } from "@/lib/conversations/types";

export async function getVendorConversationAction(conversationId: string): Promise<VendorConversationResult> {
  return getVendorConversation(conversationId);
}

/**
 * RC2, Milestone 5 (Rollout verification) — resolves this vendor's
 * Conversation for a specific event, for the per-event Messages tab
 * (components/vendor-app/vendor-event-workspace.tsx). That tab only knows
 * eventId, not conversationId; get_vendor_conversation_inbox() is the only
 * vendor-authenticated read that can answer "which Conversation is this."
 * A dedicated single-event RPC would be more efficient but this reuses
 * existing infrastructure rather than adding a new one for a single lookup.
 */
export async function getVendorConversationIdForEventAction(eventId: string): Promise<string | null> {
  const { conversations } = await getVendorConversationInbox();
  return conversations.find((c) => c.eventId === eventId)?.conversationId ?? null;
}

export async function sendVendorConversationMessageAction(
  conversationId: string,
  body: string,
  hasAttachment = false,
): Promise<SendMessageResult> {
  const result = await sendVendorConversationMessage(conversationId, body, hasAttachment);
  if (result.ok) {
    revalidatePath("/vendor/messages");
    revalidatePath(`/vendor/messages/${conversationId}`);
  }
  return result;
}

/** Sprint 1 — finishes RC2's disclosed vendor-attachment gap. */
export async function addVendorConversationMessageAttachmentAction(
  messageId: string,
  file: { url: string; name: string; size?: number | null; mimeType?: string | null },
): Promise<{ ok: boolean; message?: string }> {
  return addVendorConversationMessageAttachment(messageId, file);
}
