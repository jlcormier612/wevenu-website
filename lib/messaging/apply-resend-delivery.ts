/**
 * Resend delivery webhook body. Signature verification stays in the route.
 * Message and conversation rows keep their existing status updates.
 * A client invitation is matched only when neither message table has this
 * provider id, and only its delivery columns change.
 */
import { shouldAdvanceStatus } from "@/lib/communication/status";
import { translateEmailBounceFailure } from "@/lib/communication/failure-messages";
import { logSignalEvent } from "@/lib/leads/signals";

export type ResendDeliveryPayload = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    bounced_at?: string;
    created_at?: string;
    bounce?: {
      type?: string;
      subType?: string;
      message?: string;
      diagnosticCode?: string[] | string;
    };
  };
};

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent": "accepted",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "failed",
};

type DeliveryDb = {
  from: (table: string) => {
    select: (columns: string) => DeliveryQuery;
    update: (patch: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

type DeliveryQuery = {
  eq: (column: string, value: string) => DeliveryQuery;
  maybeSingle: <T>() => Promise<{ data: T | null }>;
};

async function findLeadIdForLegacyMessage(supabase: DeliveryDb, messageId: string): Promise<string | null> {
  const { data: threadLink } = await supabase.from("messages")
    .select("thread_id").eq("id", messageId).maybeSingle<{ thread_id: string }>();
  if (!threadLink?.thread_id) return null;
  const { data: thread } = await supabase.from("message_threads")
    .select("lead_id").eq("id", threadLink.thread_id).maybeSingle<{ lead_id: string | null }>();
  return thread?.lead_id ?? null;
}

async function findLeadIdForConversationMessage(supabase: DeliveryDb, conversationId: string): Promise<string | null> {
  const { data: conversation } = await supabase.from("conversations")
    .select("relationship_id").eq("id", conversationId).maybeSingle<{ relationship_id: string | null }>();
  if (!conversation?.relationship_id) return null;
  const { data: lead } = await supabase.from("leads")
    .select("id").eq("relationship_id", conversation.relationship_id).maybeSingle<{ id: string }>();
  return lead?.id ?? null;
}

async function suppressRecipients(
  supabase: DeliveryDb,
  payload: ResendDeliveryPayload,
  venueId: string,
  emailId: string,
) {
  if (payload.type === "email.bounced" || payload.type === "email.complained") {
    const recipients = payload.data?.to ?? [];
    const { upsertCommunicationPermission } = await import("@/lib/communication/permissions");
    for (const addr of recipients) {
      await upsertCommunicationPermission(supabase as never, {
        venueId,
        channel: "email",
        rawAddress: addr,
        status: payload.type === "email.complained" ? "opted_out" : "provider_blocked",
        source: payload.type === "email.complained" ? "resend_complaint" : "resend_bounce",
        evidence: { emailId, type: payload.type },
      });
    }
  }
  if (payload.type === "email.unsubscribed") {
    const recipients = payload.data?.to ?? [];
    const { upsertCommunicationPermission } = await import("@/lib/communication/permissions");
    for (const addr of recipients) {
      await upsertCommunicationPermission(supabase as never, {
        venueId,
        channel: "email",
        rawAddress: addr,
        status: "opted_out",
        source: "resend_unsubscribed",
        evidence: { emailId },
      });
    }
  }
}

export async function applyResendDeliveryEvent(
  supabase: DeliveryDb,
  payload: ResendDeliveryPayload,
): Promise<{ matched: "message" | "conversation" | "invitation" | "none" }> {
  const emailId = payload.data?.email_id;
  if (!emailId) return { matched: "none" };

  const { data: legacyMessage } = await supabase.from("messages")
    .select("id, venue_id, status")
    .eq("provider_id", emailId)
    .maybeSingle<{ id: string; venue_id: string; status: string }>();

  const { data: conversationMessage } = legacyMessage ? { data: null } : await supabase.from("conversation_messages")
    .select("id, venue_id, conversation_id, status")
    .eq("provider_id", emailId)
    .maybeSingle<{ id: string; venue_id: string; conversation_id: string; status: string | null }>();

  if (!legacyMessage && !conversationMessage) {
    const { data: invitation } = await supabase.from("client_invitations")
      .select("id, venue_id, delivery_status")
      .eq("provider_message_id", emailId)
      .maybeSingle<{ id: string; venue_id: string; delivery_status: string | null }>();
    if (!invitation) return { matched: "none" };

    const newStatus = EVENT_TO_STATUS[payload.type];
    if (newStatus && shouldAdvanceStatus(invitation.delivery_status, newStatus)) {
      const patch: Record<string, unknown> = { delivery_status: newStatus };
      if (payload.type === "email.bounced") {
        patch.delivery_error = translateEmailBounceFailure(payload.data.bounce ?? null);
      }
      if (payload.type === "email.delivered") patch.delivered_at = new Date().toISOString();
      const { error: statusError } = await supabase.from("client_invitations").update(patch).eq("id", invitation.id);
      if (statusError) console.error("Invitation delivery update failed:", statusError.message);
    }
    await suppressRecipients(supabase, payload, invitation.venue_id, emailId);
    return { matched: "invitation" };
  }

  const newStatus = EVENT_TO_STATUS[payload.type];
  const venueId = legacyMessage?.venue_id ?? conversationMessage!.venue_id;
  const currentStatus = legacyMessage?.status ?? conversationMessage?.status ?? null;

  if (newStatus && shouldAdvanceStatus(currentStatus, newStatus)) {
    const patch: Record<string, unknown> = { status: newStatus };
    if (payload.type === "email.bounced") {
      patch[legacyMessage ? "error_message" : "failure_reason"] = translateEmailBounceFailure(
        payload.data.bounce ?? null,
      );
    }
    if (legacyMessage) {
      if (payload.type === "email.delivered") patch.delivered_at = new Date().toISOString();
      const { error: statusError } = await supabase.from("messages").update(patch).eq("id", legacyMessage.id);
      if (statusError) console.error("Message status update failed:", statusError.message);
    } else {
      const { error: statusError } = await supabase.from("conversation_messages").update(patch).eq("id", conversationMessage!.id);
      if (statusError) console.error("Conversation message status update failed:", statusError.message);
    }
  }

  if (legacyMessage) {
    const { error: eventError } = await supabase.from("message_events").insert({
      venue_id: venueId,
      message_id: legacyMessage.id,
      event_type: payload.type,
      occurred_at: payload.created_at ?? new Date().toISOString(),
      payload: payload as unknown as Record<string, unknown>,
    });
    if (eventError) console.error("message_events insert failed:", eventError.message);
  } else {
    const { error: eventError } = await supabase.from("conversation_message_events").insert({
      message_id: conversationMessage!.id,
      event_type: payload.type,
      occurred_at: payload.created_at ?? new Date().toISOString(),
      payload: payload as unknown as Record<string, unknown>,
    });
    if (eventError) console.error("conversation_message_events insert failed:", eventError.message);
  }

  await suppressRecipients(supabase, payload, venueId, emailId);

  if (payload.type === "email.opened" || payload.type === "email.clicked") {
    const signalType = payload.type === "email.opened" ? "email_opened" : "email_clicked";
    const leadId = legacyMessage
      ? await findLeadIdForLegacyMessage(supabase, legacyMessage.id)
      : await findLeadIdForConversationMessage(supabase, conversationMessage!.conversation_id);
    if (leadId) {
      await logSignalEvent(supabase as never, venueId, leadId, signalType, {
        message_id: (legacyMessage ?? conversationMessage)!.id, email_id: emailId,
      }).catch(() => {});
      const { computeAndSaveLeadScores } = await import("@/lib/leads/scores");
      void computeAndSaveLeadScores(supabase as never, venueId, leadId).catch(() => {});
    }
  }

  return { matched: legacyMessage ? "message" : "conversation" };
}
