import { NextResponse } from "next/server";
import {
  getPortalCoupleVendorConversation,
  getPortalCoupleVendorConversations,
  sendPortalCoupleVendorMessage,
} from "@/lib/conversations/service";

/**
 * Couple ↔ vendor messaging (assignment-anchored couple_vendor threads).
 * Token + clientId auth matches other /api/portal/* routes.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  const conversationId = url.searchParams.get("conversationId") ?? "";

  if (!token || !clientId) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  if (conversationId) {
    const result = await getPortalCoupleVendorConversation(token, clientId, conversationId);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 404 });
    return NextResponse.json({
      conversationId: result.conversation.conversationId,
      vendorName: result.conversation.vendorName,
      messages: result.conversation.messages.map((m) => ({
        id: m.id,
        senderType: m.senderType,
        body: m.body,
        sentAt: m.sentAt,
        attachments: m.attachments,
      })),
    });
  }

  const list = await getPortalCoupleVendorConversations(token, clientId);
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const body = await request.json() as {
    token?: string;
    clientId?: string;
    conversationId?: string;
    body?: string;
  };
  const { token, clientId, conversationId } = body;
  if (!token || !clientId || !conversationId || typeof body.body !== "string") {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  const result = await sendPortalCoupleVendorMessage(
    token,
    clientId,
    conversationId,
    body.body,
    true,
  );
  return NextResponse.json(
    result.ok
      ? { ok: true, message_id: result.messageId }
      : { ok: false, error: result.message },
  );
}
