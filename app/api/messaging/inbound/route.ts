/**
 * POST /api/messaging/inbound
 *
 * Handles inbound email from Resend's inbound routing feature. Reply-
 * matching only — an inbound email always maps to an *existing* lead/
 * client and can never originate a new one (see app/api/leads/email-intake
 * /route.ts for the route that does the opposite, by design).
 *
 * Setup required (external):
 *   1. In Resend Dashboard → Inbound → Add Domain → verify your domain
 *   2. Add an MX record pointing to Resend's inbound servers
 *   3. Set RESEND_INBOUND_ADDRESS=inbox@replies.yourdomain.com in .env
 *   4. Configure the inbound endpoint URL to point here
 *
 * Thread matching (in order) — see lib/conversations/inbound-email.ts:
 *   1. "To" address contains thread+{conversationId}@ (subaddressing)
 *   2. "In-Reply-To" header → conversation_messages.provider_id
 *   3. Legacy thread/message ids recovered onto the current Conversation
 *   4. Sender email matches a known lead/client → that relationship's Conversation
 *   5. Unknown sender → logs and skips
 *
 * The system of record is conversation_messages. Replies are not written
 * to the legacy messages / message_threads tables.
 *
 * Resend's real email.received webhook payload is metadata only — no body,
 * no headers. Signature verification and the follow-up GET
 * /emails/receiving/{email_id} call (which is what actually returns
 * text/html/headers, including In-Reply-To) are shared with
 * app/api/leads/email-intake/route.ts via lib/resend/inbound-webhook.ts —
 * see that module's doc comment for the verified details of both.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { exitActiveEnrollmentsForRelationship } from "@/lib/message-sequences/repository";
import {
  extractConversationIdFromTo,
  parseFromEmail,
  recordInboundConversationEmail,
  resolveInboundEmailConversation,
  type InboundEmailRecorder,
  type InboundEmailStore,
} from "@/lib/conversations/inbound-email";
import {
  fetchReceivedEmailContent,
  findHeaderValue,
  htmlToText,
  verifyResendWebhookSecrets,
  type ResendInboundWebhookEvent,
} from "@/lib/resend/inbound-webhook";

function createInboundEmailStore(supabase: ReturnType<typeof createAdminClient>): InboundEmailStore {
  return {
    async findConversationById(id) {
      const { data } = await supabase.from("conversations")
        .select("id, venue_id, relationship_id")
        .eq("id", id)
        .maybeSingle<{ id: string; venue_id: string; relationship_id: string | null }>();
      return data;
    },
    async findConversationMessageByProviderId(providerId) {
      const { data } = await supabase.from("conversation_messages")
        .select("conversation_id")
        .eq("provider_id", providerId)
        .maybeSingle<{ conversation_id: string }>();
      return data;
    },
    async findLegacyMessageByProviderId(providerId) {
      const { data } = await supabase.from("messages")
        .select("thread_id")
        .eq("provider_id", providerId)
        .maybeSingle<{ thread_id: string }>();
      return data;
    },
    async findLegacyThread(threadId) {
      const { data } = await supabase.from("message_threads")
        .select("venue_id, lead_id, client_id")
        .eq("id", threadId)
        .maybeSingle<{ venue_id: string; lead_id: string | null; client_id: string | null }>();
      return data;
    },
    async findLeadByEmail(email) {
      const { data } = await supabase.from("leads")
        .select("id, venue_id, relationship_id")
        .eq("email", email)
        .limit(1)
        .maybeSingle<{ id: string; venue_id: string; relationship_id: string | null }>();
      return data;
    },
    async findClientByEmail(email) {
      const { data } = await supabase.from("clients")
        .select("id, venue_id, relationship_id")
        .eq("email", email)
        .limit(1)
        .maybeSingle<{ id: string; venue_id: string; relationship_id: string | null }>();
      return data;
    },
    async findConversationForRelationship(relationshipId) {
      const { data } = await supabase.from("conversations")
        .select("id, venue_id, relationship_id")
        .eq("relationship_id", relationshipId)
        .maybeSingle<{ id: string; venue_id: string; relationship_id: string | null }>();
      return data;
    },
    async findConversationForLead(leadId) {
      const { data: lead } = await supabase.from("leads")
        .select("relationship_id")
        .eq("id", leadId)
        .maybeSingle<{ relationship_id: string | null }>();
      if (!lead?.relationship_id) return null;
      return this.findConversationForRelationship(lead.relationship_id);
    },
    async findConversationForClient(clientId) {
      const { data: client } = await supabase.from("clients")
        .select("relationship_id")
        .eq("id", clientId)
        .maybeSingle<{ relationship_id: string | null }>();
      if (!client?.relationship_id) return null;
      return this.findConversationForRelationship(client.relationship_id);
    },
  };
}

function createInboundEmailRecorder(supabase: ReturnType<typeof createAdminClient>): InboundEmailRecorder {
  return {
    async insertConversationMessage(row) {
      const { error } = await supabase.from("conversation_messages").insert(row);
      if (error) return { ok: false, message: error.message };
      return { ok: true };
    },
    async findLatestOutboundEmail(conversationId) {
      const { data } = await supabase.from("conversation_messages")
        .select("id, status")
        .eq("conversation_id", conversationId)
        .eq("channel", "email")
        .neq("sender_type", "lead_or_client")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; status: string | null }>();
      return data;
    },
    async markMessageReplied(messageId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("conversation_messages") as any).update({ status: "replied" }).eq("id", messageId);
    },
    async logRepliedEvent(messageId) {
      await supabase.from("conversation_message_events").insert({
        message_id: messageId, event_type: "replied", occurred_at: new Date().toISOString(),
      });
    },
  };
}

export async function POST(request: NextRequest) {
  // Svix verification needs the exact raw body — parsing first would break it.
  const rawBody = await request.text();

  if (!verifyResendWebhookSecrets(rawBody, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  })) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let event: ResendInboundWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event.type !== "email.received" || !event.data) {
    return NextResponse.json({ ok: true });
  }

  const { email_id, from, to } = event.data;
  const content = await fetchReceivedEmailContent(email_id);
  const body = content?.text || (content?.html ? htmlToText(content.html) : "") || "";

  const { email: fromEmail } = parseFromEmail(from ?? "");
  if (!fromEmail || !body) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  const inReplyTo = content?.headers ? findHeaderValue(content.headers, "in-reply-to") : null;

  const match = await resolveInboundEmailConversation(createInboundEmailStore(supabase), {
    toAddresses: to ?? [],
    inReplyTo,
    fromEmail,
  });

  if (!match) {
    console.warn("Inbound email from unknown sender:", fromEmail, {
      subaddress: extractConversationIdFromTo(to ?? []),
    });
    return NextResponse.json({ ok: true });
  }

  const recorded = await recordInboundConversationEmail(
    createInboundEmailRecorder(supabase),
    match,
    body,
  );
  if (!recorded.ok) {
    console.error("Inbound conversation email insert failed:", recorded.message);
    return NextResponse.json({ error: "Failed to record message." }, { status: 500 });
  }

  let relationshipId = match.relationshipId;
  let entityType = match.entityType;
  let entityId = match.entityId;

  if (!relationshipId || !entityType) {
    const { data: convo } = await supabase.from("conversations")
      .select("relationship_id")
      .eq("id", match.conversationId)
      .maybeSingle<{ relationship_id: string | null }>();
    relationshipId = convo?.relationship_id ?? relationshipId;
  }

  if (relationshipId && (!entityType || !entityId)) {
    const { data: lead } = await supabase.from("leads")
      .select("id").eq("relationship_id", relationshipId)
      .maybeSingle<{ id: string }>();
    if (lead) {
      entityType = "lead";
      entityId = lead.id;
    } else {
      const { data: client } = await supabase.from("clients")
        .select("id").eq("relationship_id", relationshipId)
        .maybeSingle<{ id: string }>();
      if (client) {
        entityType = "client";
        entityId = client.id;
      }
    }
  }

  if (entityType === "lead" && entityId) {
    const { computeAndSaveLeadScores } = await import("@/lib/leads/scores");
    void computeAndSaveLeadScores(supabase, match.venueId, entityId).catch(() => {});
  }

  if (relationshipId) {
    void exitActiveEnrollmentsForRelationship(supabase, match.venueId, relationshipId, "exited_reply")
      .catch((e) => console.error("Series exit-on-reply failed:", e));
  }

  return NextResponse.json({ ok: true });
}
