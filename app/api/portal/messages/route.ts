import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { sendMessageEmail } from "@/lib/messages/notify";
import { getPortalConversation, sendPortalConversationMessage } from "@/lib/conversations/service";
import type { PortalConversationMessage } from "@/lib/conversations/types";
import type { CoupleMessage, PortalThread } from "@/lib/messages/types";

/**
 * RC2, Milestone 2 — this route now reads/writes through Conversations
 * instead of couple_threads/couple_messages. The response shape below is
 * unchanged so components/portal/message-section.tsx needs no edits: this
 * is a backend swap, not a UI migration. See
 * docs/rc2-messaging-conversations-implementation-plan.md.
 */
function toLegacyMessage(m: PortalConversationMessage): CoupleMessage {
  return {
    id: m.id,
    sender_type: m.senderType === "venue_staff" || m.senderType === "system" ? "venue" : "couple",
    body: m.body,
    created_at: m.sentAt,
    venue_read_at: m.venueReadAt,
    couple_read_at: m.contactReadAt,
    attachments: m.attachments.map((a) => ({
      id: a.id,
      file_url: a.fileUrl,
      file_name: a.fileName,
      file_size: a.fileSize,
      mime_type: a.mimeType,
      // Conversation attachments don't carry their own timestamp (they're
      // always attached in the same request as the message they belong to)
      // — the parent message's sent_at is accurate enough for display.
      created_at: m.sentAt,
    })),
  };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const result = await getPortalConversation(token);
  if (!result.ok) return NextResponse.json({ thread_id: null, messages: [] });

  const thread: PortalThread = {
    thread_id: result.conversation.conversationId,
    messages: result.conversation.messages.map(toLegacyMessage),
  };
  return NextResponse.json(thread);
}

export async function POST(request: Request) {
  const { token, body } = await request.json() as { token?: string; body?: string };
  // Not `!body?.trim()` — the couple UI sends a literal " " for an
  // attachment-only message (see message-section.tsx's `text || " "`),
  // which trims to empty and would be rejected here before ever reaching
  // the attachment-aware empty-body allowance in the service layer below.
  // That was a real, pre-existing bug: attachment-only sends from the
  // couple portal have never actually worked, on either backend.
  if (!token || typeof body !== "string" || body.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const result = await sendPortalConversationMessage(token, body, true);

  if (result.ok) {
    void notifyVenue(token, body.trim());
  }

  return NextResponse.json(result.ok ? { ok: true, message_id: result.messageId } : { ok: false, error: result.message });
}

async function notifyVenue(token: string, preview: string) {
  try {
    const supabase = await createClient();
    const { data: session } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();

    if (!session) return;

    const [{ data: venue }, { data: client }] = await Promise.all([
      supabase
        .from("venues")
        .select("name, email")
        .eq("id", session.venue_id)
        .maybeSingle<{ name: string; email: string | null }>(),
      supabase
        .from("clients")
        .select("first_name, partner_first_name")
        .eq("id", session.client_id)
        .maybeSingle<{ first_name: string; partner_first_name: string | null }>(),
    ]);

    if (!venue?.email) return;

    const coupleName = [client?.first_name, client?.partner_first_name]
      .filter(Boolean).join(" & ") || "Your Couple";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
    await sendMessageEmail({
      to: venue.email,
      senderName: coupleName,
      bodyPreview: preview.slice(0, 200),
      ctaUrl: `${baseUrl}/messaging`,
      ctaLabel: "Reply in Hello to Cheers",
    });
  } catch (err) {
    console.error("[messages] notifyVenue failed:", err);
  }
}
