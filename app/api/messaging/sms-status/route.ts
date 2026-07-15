/**
 * POST /api/messaging/sms-status
 *
 * Twilio's StatusCallback for outbound SMS — see lib/sms/send.ts, which
 * attaches this route's URL to every send. Without it, a "sent" text and
 * one silently dropped by a carrier look identical; this is what actually
 * answers "did my text go?" for SMS, the same way the Resend webhook does
 * for email (see app/api/messaging/webhook/route.ts).
 *
 * Twilio's payload is form-encoded, matching sms-inbound's shape:
 *   MessageSid, MessageStatus (queued|sending|sent|delivered|undelivered|failed),
 *   ErrorCode, ErrorMessage, To, From.
 *
 * SMS has never been a legacy `messages` channel (see lib/scheduled-
 * messages/processor.ts's own comment on that), so `provider_id` here is
 * only ever looked up against conversation_messages — checking `messages`
 * too costs one query and keeps this symmetric with the Resend webhook if
 * that ever changes.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { verifyTwilioSignature } from "@/lib/sms/verify";
import { shouldAdvanceStatus } from "@/lib/communication/status";
import { translateSmsFailure } from "@/lib/communication/failure-messages";

const TWILIO_STATUS_TO_SHARED: Record<string, string> = {
  queued:       "sending",
  sending:      "sending",
  sent:         "accepted",
  delivered:    "delivered",
  undelivered:  "failed",
  failed:       "failed",
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const paramsObj = Object.fromEntries(params.entries());

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/messaging/sms-status`;
  const signature = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(webhookUrl, paramsObj, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const messageSid = params.get("MessageSid")?.trim();
  const twilioStatus = params.get("MessageStatus")?.trim();
  if (!messageSid || !twilioStatus) return NextResponse.json({ ok: true });

  const newStatus = TWILIO_STATUS_TO_SHARED[twilioStatus];
  if (!newStatus) return NextResponse.json({ ok: true }); // unrecognized status — nothing to do

  const supabase = createAdminClient();

  const { data: message } = await supabase.from("conversation_messages")
    .select("id, venue_id, status")
    .eq("provider_id", messageSid)
    .maybeSingle<{ id: string; venue_id: string; status: string | null }>();

  if (!message) return NextResponse.json({ ok: true }); // unknown message — ignore gracefully

  if (shouldAdvanceStatus(message.status, newStatus)) {
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "failed") {
      const errorCode = params.get("ErrorCode");
      const errorMessage = params.get("ErrorMessage") ?? "";
      patch.failure_reason = translateSmsFailure(`${errorCode ?? ""} ${errorMessage}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: statusError } = await (supabase.from("conversation_messages") as any).update(patch).eq("id", message.id);
    if (statusError) console.error("SMS status update failed:", statusError.message);
  }

  const { error: eventError } = await supabase.from("conversation_message_events").insert({
    message_id: message.id,
    event_type: `sms.${twilioStatus}`,
    occurred_at: new Date().toISOString(),
    payload: paramsObj,
  });
  if (eventError) console.error("conversation_message_events insert failed:", eventError.message);

  return NextResponse.json({ ok: true });
}
