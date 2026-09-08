/**
 * POST /api/messaging/sms-status
 *
 * Twilio StatusCallback for outbound SMS (ISV: verify with subaccount Auth Token
 * resolved from AccountSid → venue_twilio_accounts).
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { verifyTwilioSignature } from "@/lib/sms/verify";
import { shouldAdvanceStatus } from "@/lib/communication/status";
import { translateSmsFailure } from "@/lib/communication/failure-messages";
import { resolveVenueTwilioForWebhookAccountSid } from "@/lib/sms/venue-twilio-resolve";

const TWILIO_STATUS_TO_SHARED: Record<string, string> = {
  queued:       "sending",
  sending:      "sending",
  sent:         "accepted",
  delivered:    "delivered",
  undelivered:  "undelivered",
  failed:       "failed",
};

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

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/messaging/sms-status`;
  const signature = request.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(webhookUrl, paramsObj, signature, resolved.ctx.secret.authToken)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const messageSid = params.get("MessageSid")?.trim();
  const twilioStatus = params.get("MessageStatus")?.trim();
  if (!messageSid || !twilioStatus) return NextResponse.json({ ok: true });

  const newStatus = TWILIO_STATUS_TO_SHARED[twilioStatus];
  if (!newStatus) return NextResponse.json({ ok: true }); // unrecognized status — nothing to do

  const supabase = createAdminClient();

  const { data: message } = await supabase.from("conversation_messages")
    .select("id, venue_id, status, provider_account_sid")
    .eq("provider_id", messageSid)
    .maybeSingle<{
      id: string;
      venue_id: string;
      status: string | null;
      provider_account_sid: string | null;
    }>();

  if (!message) return NextResponse.json({ ok: true }); // unknown message — ignore gracefully

  // Tenant isolation: status callback AccountSid must match the message's venue account.
  if (message.provider_account_sid && message.provider_account_sid !== accountSid) {
    return NextResponse.json({ error: "Account mismatch." }, { status: 401 });
  }
  if (message.venue_id !== resolved.ctx.account.venueId) {
    return NextResponse.json({ error: "Venue mismatch." }, { status: 401 });
  }

  if (shouldAdvanceStatus(message.status, newStatus)) {
    const patch: Record<string, unknown> = { status: newStatus };
    if (!message.provider_account_sid) {
      patch.provider_account_sid = accountSid;
    }
    if (newStatus === "failed" || newStatus === "undelivered") {
      const errorCode = params.get("ErrorCode");
      const errorMessage = params.get("ErrorMessage") ?? "";
      patch.failure_reason = translateSmsFailure(`${errorCode ?? ""} ${errorMessage}`);
      // Persist provider opt-out / block so future sends are refused server-side.
      const to = params.get("To")?.trim();
      if (to && (errorCode === "21610" || /opted out|unsubscribed/i.test(errorMessage))) {
        const { upsertCommunicationPermission } = await import("@/lib/communication/permissions");
        await upsertCommunicationPermission(supabase, {
          venueId: message.venue_id,
          channel: "sms",
          rawAddress: to,
          status: errorCode === "21610" ? "opted_out" : "provider_blocked",
          source: "twilio_status_callback",
          evidence: { errorCode, errorMessage, messageSid, accountSid },
        });
      } else if (to && (newStatus === "failed" || newStatus === "undelivered")) {
        // Non-opt-out carrier failures — mark unreachable without inventing opt-out.
        if (errorCode && ["30003", "30005", "30006", "21211", "21614"].includes(errorCode)) {
          const { upsertCommunicationPermission } = await import("@/lib/communication/permissions");
          await upsertCommunicationPermission(supabase, {
            venueId: message.venue_id,
            channel: "sms",
            rawAddress: to,
            status: "provider_blocked",
            source: "twilio_status_callback",
            evidence: { errorCode, errorMessage, messageSid, accountSid },
          });
        }
      }
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
