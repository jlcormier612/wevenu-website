/**
 * POST /api/messaging/sms-inbound
 *
 * Handles inbound SMS from Twilio (2026-07-11 — texting added ahead of
 * launch; see lib/sms/send.ts for the send side).
 *
 * Setup required (external):
 *   1. Buy or port a phone number in the Twilio Console (or set up a
 *      Messaging Service — recommended, gets STOP/START/HELP opt-out
 *      compliance handling for free).
 *   2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
 *      TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER in .env.
 *   3. In the Twilio Console, set this route's full URL
 *      (${NEXT_PUBLIC_APP_URL}/api/messaging/sms-inbound) as the number's
 *      (or Messaging Service's) "A message comes in" webhook, POST method.
 *
 * Matching (mirrors app/api/messaging/inbound/route.ts's email matching —
 * one shared Twilio number across every venue on Wevenu, matched by sender
 * phone number, not by which number they texted):
 *   1. Normalize the "From" number to digits, call find_relationship_by_phone
 *   2. Match found → find-or-create that relationship's Conversation, insert
 *   3. No match → log and skip (future: unmatched queue)
 *
 * Twilio inbound payload is form-encoded (application/x-www-form-urlencoded),
 * not JSON: From, To, Body, MessageSid, ...
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { verifyTwilioSignature } from "@/lib/sms/verify";
import { exitActiveEnrollmentsForRelationship } from "@/lib/message-sequences/repository";
import { shouldAdvanceStatus } from "@/lib/communication/status";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const paramsObj = Object.fromEntries(params.entries());

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/messaging/sms-inbound`;
  const signature = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(webhookUrl, paramsObj, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const from = params.get("From")?.trim();
  const body = params.get("Body")?.trim();
  if (!from || !body) return NextResponse.json({ ok: true });

  // TR-M7 pattern (see inbound email route): no Supabase session here, so
  // this must use the admin client — RLS would silently reject every write.
  const supabase = createAdminClient();

  const { data: match } = await supabase.rpc("find_relationship_by_phone", { p_phone: from })
    .maybeSingle<{ venue_id: string; relationship_id: string; entity_type: string; entity_id: string; display_name: string | null }>();

  if (!match) {
    console.warn("Inbound SMS from unmatched number:", from);
    return NextResponse.json({ ok: true });
  }

  // Find or create this relationship's Conversation. In the normal case one
  // already exists — provision_conversation_for_relationship provisions it
  // the moment a relationship is created — this is a fallback for
  // relationships that predate that trigger, not the common path.
  let conversationId: string;
  const { data: existing } = await supabase.from("conversations")
    .select("id").eq("relationship_id", match.relationship_id).maybeSingle<{ id: string }>();
  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created, error: createError } = await supabase.from("conversations")
      .insert({ venue_id: match.venue_id, relationship_id: match.relationship_id })
      .select("id").single<{ id: string }>();
    if (createError || !created) {
      console.error("Failed to create conversation for inbound SMS:", createError?.message);
      return NextResponse.json({ error: "Failed to create conversation." }, { status: 500 });
    }
    conversationId = created.id;
  }

  // last_message_at / venue_unread update themselves via
  // touch_conversation_on_message — no manual update needed here.
  const { error: insertError } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    venue_id: match.venue_id,
    sender_type: "lead_or_client",
    channel: "sms",
    body,
  });
  if (insertError) {
    console.error("Inbound SMS insert failed:", insertError.message);
    return NextResponse.json({ error: "Failed to record message." }, { status: 500 });
  }

  // Communication Trust Experience — same "replied" marking as the email
  // inbound route, for the most recent outbound text in this conversation.
  const { data: lastOutbound } = await supabase.from("conversation_messages")
    .select("id, status").eq("conversation_id", conversationId).eq("channel", "sms")
    .neq("sender_type", "lead_or_client").order("sent_at", { ascending: false }).limit(1).maybeSingle<{ id: string; status: string | null }>();
  if (lastOutbound && shouldAdvanceStatus(lastOutbound.status, "replied")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("conversation_messages") as any).update({ status: "replied" }).eq("id", lastOutbound.id);
    // Message Timeline needs a timestamp for every transition — see the
    // identical comment in app/api/messaging/inbound/route.ts.
    await supabase.from("conversation_message_events").insert({
      message_id: lastOutbound.id, event_type: "replied", occurred_at: new Date().toISOString(),
    });
  }

  // Stop on reply (§3.3) — a reply means a human is handling this
  // personally now, so any Series in progress should get out of the way.
  void exitActiveEnrollmentsForRelationship(supabase, match.venue_id, match.relationship_id, "exited_reply")
    .catch((e) => console.error("Series exit-on-reply failed:", e));

  return NextResponse.json({ ok: true });
}
