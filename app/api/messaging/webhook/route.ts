/**
 * POST /api/messaging/webhook
 *
 * Handles Resend delivery and engagement webhooks.
 * Resend signs webhooks with Svix; we verify the signature with HMAC-SHA256
 * using the RESEND_WEBHOOK_SECRET env var.
 *
 * Event types handled:
 *   email.sent           → status = 'accepted'  (provider took it — not delivered)
 *   email.delivered      → status = 'delivered', sets delivered_at
 *   email.opened         → status = 'opened',  logs a lead engagement signal
 *   email.clicked        → status = 'clicked', logs a lead engagement signal
 *   email.delivery_delayed → no status change, logged to the event history
 *   email.bounced        → status = 'failed', plain-language failure_reason
 *   email.complained     → logged to the event history (spam complaint)
 *
 * Communication Trust Experience — a message sent through the newer
 * Conversation system (conversation_messages) now carries the same
 * provider_id as a legacy one, so this single route updates whichever
 * table actually sent it rather than assuming `messages`. Status only ever
 * moves forward (see lib/communication/status.ts) — a redelivered or
 * out-of-order webhook can never erase a status the venue already saw.
 *
 * Configure in Resend Dashboard → Webhooks → Add Endpoint → point to this URL.
 */

import { createHmac } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import { logSignalEvent } from "@/lib/leads/signals";
import { shouldAdvanceStatus } from "@/lib/communication/status";
import { translateEmailFailure } from "@/lib/communication/failure-messages";

type ResendWebhookPayload = {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    bounced_at?: string;
    created_at?: string;
  };
};

function verifySignature(body: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification in development

  const svixId = headers.get("svix-id") ?? "";
  const svixTimestamp = headers.get("svix-timestamp") ?? "";
  const svixSignature = headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Verify timestamp is within 5 minutes to prevent replay attacks
  const ts = parseInt(svixTimestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac("sha256", secret).update(toSign).digest("base64");
  const signatures = svixSignature.split(" ").map((s) => s.replace(/^v1,/, ""));
  return signatures.some((sig) => sig === expected);
}

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent":      "accepted",
  "email.delivered": "delivered",
  "email.opened":    "opened",
  "email.clicked":   "clicked",
  "email.bounced":   "failed",
};

type AdminClient = ReturnType<typeof createAdminClient>;

async function findLeadIdForLegacyMessage(supabase: AdminClient, messageId: string): Promise<string | null> {
  const { data: threadLink } = await supabase.from("messages")
    .select("thread_id").eq("id", messageId).maybeSingle<{ thread_id: string }>();
  if (!threadLink?.thread_id) return null;
  const { data: thread } = await supabase.from("message_threads")
    .select("lead_id").eq("id", threadLink.thread_id).maybeSingle<{ lead_id: string | null }>();
  return thread?.lead_id ?? null;
}

async function findLeadIdForConversationMessage(supabase: AdminClient, conversationId: string): Promise<string | null> {
  const { data: conversation } = await supabase.from("conversations")
    .select("relationship_id").eq("id", conversationId).maybeSingle<{ relationship_id: string | null }>();
  if (!conversation?.relationship_id) return null;
  const { data: lead } = await supabase.from("leads")
    .select("id").eq("relationship_id", conversation.relationship_id).maybeSingle<{ id: string }>();
  return lead?.id ?? null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  if (!verifySignature(body, request.headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const emailId = payload.data?.email_id;
  if (!emailId) return NextResponse.json({ ok: true }); // Ignore events without email_id

  try {
    // TR-M7: webhook call, no Supabase session — the anon/cookie client's
    // reads and writes were silently rejected by RLS here.
    const supabase = createAdminClient();

    const { data: legacyMessage } = await supabase.from("messages")
      .select("id, venue_id, status")
      .eq("provider_id", emailId)
      .maybeSingle<{ id: string; venue_id: string; status: string }>();

    const { data: conversationMessage } = legacyMessage ? { data: null } : await supabase.from("conversation_messages")
      .select("id, venue_id, conversation_id, status")
      .eq("provider_id", emailId)
      .maybeSingle<{ id: string; venue_id: string; conversation_id: string; status: string | null }>();

    if (!legacyMessage && !conversationMessage) {
      // Unknown message — could be from before this system; ignore gracefully
      return NextResponse.json({ ok: true });
    }

    const newStatus = EVENT_TO_STATUS[payload.type];
    const venueId = legacyMessage?.venue_id ?? conversationMessage!.venue_id;
    const currentStatus = legacyMessage?.status ?? conversationMessage?.status ?? null;

    if (newStatus && shouldAdvanceStatus(currentStatus, newStatus)) {
      const patch: Record<string, unknown> = { status: newStatus };
      if (payload.type === "email.bounced") {
        const raw = `Bounced at ${payload.data.bounced_at ?? payload.created_at}`;
        patch[legacyMessage ? "error_message" : "failure_reason"] = translateEmailFailure(raw);
      }
      if (legacyMessage) {
        if (payload.type === "email.delivered") patch.delivered_at = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: statusError } = await (supabase.from("messages") as any).update(patch).eq("id", legacyMessage.id);
        if (statusError) console.error("Message status update failed:", statusError.message);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: statusError } = await (supabase.from("conversation_messages") as any).update(patch).eq("id", conversationMessage!.id);
        if (statusError) console.error("Conversation message status update failed:", statusError.message);
      }
    }

    // Always log the event for audit trail (Phase 7 diagnostics)
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

    // For email opens and clicks, find the lead and log an engagement signal
    if (payload.type === "email.opened" || payload.type === "email.clicked") {
      const signalType = payload.type === "email.opened" ? "email_opened" : "email_clicked";
      const leadId = legacyMessage
        ? await findLeadIdForLegacyMessage(supabase, legacyMessage.id)
        : await findLeadIdForConversationMessage(supabase, conversationMessage!.conversation_id);
      if (leadId) {
        await logSignalEvent(supabase, venueId, leadId, signalType, {
          message_id: (legacyMessage ?? conversationMessage)!.id, email_id: emailId,
        }).catch(() => {}); // non-blocking
        // Immediately refresh interest score — email engagement is a real-time signal
        const { computeAndSaveLeadScores } = await import("@/lib/leads/scores");
        void computeAndSaveLeadScores(supabase, venueId, leadId).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Messaging webhook error:", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
