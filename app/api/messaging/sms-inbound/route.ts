/**
 * POST /api/messaging/sms-inbound
 *
 * Handles inbound SMS/MMS from Twilio (ISV: one subaccount per venue).
 *
 * Tenant routing (authoritative):
 *   1. AccountSid → venue_twilio_accounts.venue_id
 *   2. Verify signature with that subaccount's Auth Token
 *   3. From → find_relationship_by_phone_for_venue(phone, venue_id)
 *   4. Match → find-or-create venue_couple Conversation, insert message (idempotent on MessageSid)
 *   5. Persist NumMedia MediaUrl* with venue credentials + Documents registration
 *   6. No match → log and skip
 *
 * Media-only MMS (empty Body) is allowed when NumMedia > 0.
 */

import { type NextRequest, NextResponse } from "next/server";
import { findOrCreateVenueCoupleConversation } from "@/lib/conversations/venue-couple-conversation";
import { createAdminClient } from "@/integrations/supabase/admin";
import { exitActiveEnrollmentsForRelationship } from "@/lib/message-sequences/repository";
import { shouldAdvanceStatus } from "@/lib/communication/status";
import { verifyTwilioSignature } from "@/lib/sms/verify";
import { parseInboundTwilioMedia, persistTwilioMediaToConversationStorage } from "@/lib/sms/media";
import { registerMessageAttachmentAsDocument } from "@/lib/conversations/attachment-document";
import { resolveVenueTwilioForWebhookAccountSid } from "@/lib/sms/venue-twilio-resolve";
import { twilioMediaBasicAuth } from "@/lib/sms/venue-twilio-secrets";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const paramsObj = Object.fromEntries(params.entries());

  const accountSid = params.get("AccountSid")?.trim();
  if (!accountSid) {
    return NextResponse.json({ error: "Missing AccountSid." }, { status: 401 });
  }

  const resolved = await resolveVenueTwilioForWebhookAccountSid(accountSid);
  if (!resolved.ok) {
    return NextResponse.json({ error: "Unknown Twilio account." }, { status: 401 });
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/messaging/sms-inbound`;
  const signature = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(webhookUrl, paramsObj, signature, resolved.ctx.secret.authToken)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const venueId = resolved.ctx.account.venueId;
  const from = params.get("From")?.trim();
  const body = (params.get("Body") ?? "").trim();
  const messageSid = params.get("MessageSid")?.trim() || null;
  const optOutType = params.get("OptOutType")?.trim() || null;
  const media = parseInboundTwilioMedia(params);

  if (!from) return NextResponse.json({ ok: true });
  if (!body && media.length === 0 && !optOutType) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();

  // Idempotency — Twilio retries must not create duplicate messages.
  if (messageSid) {
    const { data: existingMsg } = await supabase.from("conversation_messages")
      .select("id")
      .eq("provider_id", messageSid)
      .maybeSingle<{ id: string }>();
    if (existingMsg) return NextResponse.json({ ok: true, deduped: true });
  }

  const { data: match } = await supabase.rpc("find_relationship_by_phone_for_venue", {
    p_phone: from,
    p_venue_id: venueId,
  }).maybeSingle<{
    venue_id: string;
    relationship_id: string;
    entity_type: string;
    entity_id: string;
    display_name: string | null;
  }>();

  if (!match) {
    console.warn("Inbound SMS from unmatched number for venue:", venueId, from);
    return NextResponse.json({ ok: true });
  }

  // Persist STOP/START (never treat ordinary inbound as opt-in).
  const { permissionFromTwilioOptOut, upsertCommunicationPermission } = await import("@/lib/communication/permissions");
  const permChange = permissionFromTwilioOptOut(optOutType, body);
  if (permChange) {
    await upsertCommunicationPermission(supabase, {
      venueId: match.venue_id,
      channel: "sms",
      rawAddress: from,
      status: permChange.status,
      source: permChange.source,
      evidence: { optOutType, body, messageSid, accountSid },
      relationshipId: match.relationship_id,
    });
    // STOP with empty body still exits sequences so automation cannot keep retrying.
    if (permChange.status === "opted_out") {
      void exitActiveEnrollmentsForRelationship(
        supabase,
        match.venue_id,
        match.relationship_id,
        "exited_reply",
      ).catch((e) => console.error("Series exit-on-STOP failed:", e));
    }
  }

  // STOP/START/HELP may still create a conversation note when there is body text,
  // but HELP alone with no media does not need a transcript row beyond permission.
  if (!body && media.length === 0) {
    return NextResponse.json({ ok: true, permissionUpdated: !!permChange });
  }

  const conversationId = await findOrCreateVenueCoupleConversation(
    supabase,
    match.venue_id,
    match.relationship_id,
  );
  if (!conversationId) {
    console.error("Failed to create conversation for inbound SMS");
    return NextResponse.json({ error: "Failed to create conversation." }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase.from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      venue_id: match.venue_id,
      sender_type: "lead_or_client",
      channel: "sms",
      body: body || (media.length > 0 ? "" : body),
      provider_id: messageSid,
      provider_account_sid: accountSid,
      status: "received",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    // Unique provider_id race with a concurrent retry.
    if (messageSid && /duplicate|unique|provider/i.test(insertError.message)) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    console.error("Inbound SMS insert failed:", insertError.message);
    return NextResponse.json({ error: "Failed to record message." }, { status: 500 });
  }

  const messageId = inserted.id;
  const mediaAuth = twilioMediaBasicAuth(resolved.ctx.secret);

  for (const item of media) {
    const stored = await persistTwilioMediaToConversationStorage({
      venueId: match.venue_id,
      conversationId,
      media: item,
      messageSid: messageSid ?? messageId,
      mediaBasicAuth: mediaAuth,
    });
    if (!stored.ok) {
      console.error("Inbound MMS persist failed:", stored.message);
      continue;
    }
    const { data: att, error: attError } = await supabase.from("conversation_message_attachments")
      .insert({
        message_id: messageId,
        file_url: stored.url,
        file_name: stored.fileName,
        file_size: stored.fileSize,
        mime_type: stored.mimeType,
      })
      .select("id")
      .single<{ id: string }>();
    if (attError) {
      console.error("Inbound MMS attachment row failed:", attError.message);
      continue;
    }
    await registerMessageAttachmentAsDocument(supabase as never, {
      messageId,
      attachmentId: att.id,
      file: {
        url: stored.url,
        name: stored.fileName,
        size: stored.fileSize,
        mimeType: stored.mimeType,
      },
    });
  }

  const { data: lastOutbound } = await supabase.from("conversation_messages")
    .select("id, status").eq("conversation_id", conversationId).eq("channel", "sms")
    .neq("sender_type", "lead_or_client").order("sent_at", { ascending: false }).limit(1)
    .maybeSingle<{ id: string; status: string | null }>();
  if (lastOutbound && shouldAdvanceStatus(lastOutbound.status, "replied")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("conversation_messages") as any).update({ status: "replied" }).eq("id", lastOutbound.id);
    await supabase.from("conversation_message_events").insert({
      message_id: lastOutbound.id, event_type: "replied", occurred_at: new Date().toISOString(),
    });
  }

  void exitActiveEnrollmentsForRelationship(supabase, match.venue_id, match.relationship_id, "exited_reply")
    .catch((e) => console.error("Series exit-on-reply failed:", e));

  return NextResponse.json({ ok: true });
}
