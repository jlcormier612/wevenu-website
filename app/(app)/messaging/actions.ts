"use server";

import { revalidatePath } from "next/cache";

import { sendMessage } from "@/lib/messaging/service";
import type { ComposeInput, MessageEntityType, SendResult } from "@/lib/messaging/types";
import * as conversations from "@/lib/conversations/service";
import type { ConversationDetail, ConversationSummary, SendMessageResult } from "@/lib/conversations/types";
import { getActiveEnrollmentsForRelationship } from "@/lib/message-sequences/service";
import type { SequenceEnrollment } from "@/lib/message-sequences/types";
import { getTemplates } from "@/lib/message-templates/service";
import type { MessageTemplate } from "@/lib/message-templates/types";
import * as scheduledMessages from "@/lib/scheduled-messages/service";
import type {
  ScheduleMessageResult, ScheduledMessage, ScheduledMessageActionResult, ScheduledMessageChannel,
} from "@/lib/scheduled-messages/types";
import { getCommunicationReadiness, sendTestEmail, sendTestSms } from "@/lib/communication/readiness";
import type { CommunicationReadiness, TestSendResult } from "@/lib/communication/readiness";
import { getMessageTimeline } from "@/lib/communication/timeline";
import type { TimelineStep } from "@/lib/communication/timeline";

export async function sendMessageAction(
  entityType: MessageEntityType,
  entityId: string,
  input: ComposeInput,
): Promise<SendResult> {
  const result = await sendMessage(entityType, entityId, input);
  if (result.ok) {
    const paths: Record<MessageEntityType, string> = {
      lead:   `/leads/${entityId}`,
      client: `/clients/${entityId}`,
      event:  `/events/${entityId}`,
    };
    revalidatePath(paths[entityType]);
    revalidatePath("/messaging");
  }
  return result;
}

// ---- Program 2 Phase 2B — Conversation actions (flag-gated UI only) --------

export async function getConversationInboxAction(): Promise<{ conversations: ConversationSummary[]; totalUnread: number }> {
  return conversations.getConversationInbox();
}

export async function getConversationAction(conversationId: string): Promise<ConversationDetail | null> {
  return conversations.getConversation(conversationId);
}

export async function sendConversationMessageAction(
  conversationId: string,
  body: string,
  channel: string,
  emailSubject?: string,
): Promise<SendMessageResult> {
  const result = await conversations.sendConversationMessage(conversationId, body, channel, emailSubject);
  if (result.ok) {
    revalidatePath("/messaging");
  }
  return result;
}

export async function setConversationAssignedStaffAction(conversationId: string, staffId: string | null): Promise<void> {
  await conversations.setConversationAssignedStaff(conversationId, staffId);
  revalidatePath("/messaging");
}

/** Active Automations for the Conversation Workspace (Communication Workspace Completion) — read-only, never mutates Automations. */
export async function getActiveEnrollmentsForConversationAction(relationshipId: string): Promise<SequenceEnrollment[]> {
  return getActiveEnrollmentsForRelationship(relationshipId);
}

// ---- Communication Platform Phase 2 — Scheduled Sends -----------------------

export async function getComposeTemplatesAction(): Promise<MessageTemplate[]> {
  return getTemplates();
}

export async function scheduleMessageAction(
  conversationId: string,
  templateId: string | null,
  channel: ScheduledMessageChannel,
  emailSubject: string,
  body: string,
  scheduledFor: string,
): Promise<ScheduleMessageResult> {
  const result = await scheduledMessages.scheduleMessageForConversation(
    conversationId, templateId, channel, emailSubject, body, scheduledFor,
  );
  if (result.ok) revalidatePath("/messaging");
  return result;
}

export async function getScheduledForConversationAction(conversationId: string): Promise<ScheduledMessage[]> {
  return scheduledMessages.getScheduledForConversation(conversationId);
}

export async function cancelScheduledMessageAction(id: string): Promise<ScheduledMessageActionResult> {
  const result = await scheduledMessages.cancelScheduledMessage(id);
  if (result.ok) revalidatePath("/messaging");
  return result;
}

/** "Scheduled Today" tile on the Communication Dashboard. */
export async function getScheduledCountForTodayAction(): Promise<number> {
  return scheduledMessages.getScheduledCountForToday();
}

// ── Communication Trust Experience, Phase 6 — Communication Readiness ────────

export async function getCommunicationReadinessAction(): Promise<CommunicationReadiness> {
  return getCommunicationReadiness();
}

export async function sendTestEmailAction(): Promise<TestSendResult> {
  return sendTestEmail();
}

export async function sendTestSmsAction(): Promise<TestSendResult> {
  return sendTestSms();
}

// ── Communication Trust Experience — Message Timeline ────────────────────────

export async function getMessageTimelineAction(messageId: string, source: "legacy" | "conversation"): Promise<TimelineStep[]> {
  return getMessageTimeline(messageId, source);
}
