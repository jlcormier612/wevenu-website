/**
 * SMS sending — Twilio ISV subaccount model.
 *
 * Outbound resolution: venueId → venue_twilio_accounts → Secrets Manager
 * credentials → Messaging Service. Uses API Key SID + secret for REST.
 * Does not fall back to a global parent Messaging Service for customer sends.
 *
 * See lib/communication/mode.ts for COMMUNICATION_MODE.
 */

import { getCommunicationMode, sandboxPhoneRecipient } from "@/lib/communication/mode";
import { resolveVenueTwilioForSend } from "@/lib/sms/venue-twilio-resolve";
import { twilioRestBasicAuth } from "@/lib/sms/venue-twilio-secrets";

export type SmsPayload = {
  to: string;      // E.164 format, e.g. "+16155551234"
  body: string;
  /** Publicly fetchable MediaUrl values (Twilio GETs these). Max 10; total ≤ 5MB. */
  mediaUrls?: string[];
  /**
   * Venue scope for Twilio account resolution and communication_permissions.
   * Required for every customer/relationship send so callers cannot bypass.
   */
  venueId: string;
  /**
   * Only for Communication Health self-test to the venue's own number.
   * Never set this for lead/client/vendor outbound SMS/MMS.
   */
  skipPermissionCheck?: boolean;
};

export type SmsSendResult =
  | {
      ok: true;
      providerId: string;
      providerAccountSid: string;
      sandboxRedirectedFrom?: string;
    }
  | { ok: false; message: string };

const NOT_CONFIGURED =
  "Texting isn't set up yet. Open Communication Health to see why.";

export async function isSmsConfigured(venueId: string): Promise<boolean> {
  if (!venueId?.trim()) return false;
  const resolved = await resolveVenueTwilioForSend(venueId);
  return resolved.ok;
}

export async function sendSms(payload: SmsPayload): Promise<SmsSendResult> {
  const mode = getCommunicationMode();
  if (mode === "disabled") {
    return { ok: false, message: "Sending is turned off in this environment." };
  }

  if (!payload.venueId?.trim()) {
    return { ok: false, message: "Texting isn't available — missing venue context." };
  }

  const resolved = await resolveVenueTwilioForSend(payload.venueId);
  if (!resolved.ok) {
    return { ok: false, message: NOT_CONFIGURED };
  }

  const { account, secret } = resolved.ctx;
  const messagingServiceSid = account.messagingServiceSid;

  if (!payload.to.trim()) {
    return { ok: false, message: "No phone number on file to text." };
  }
  const mediaUrls = (payload.mediaUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (!payload.body.trim() && mediaUrls.length === 0) {
    return { ok: false, message: "A text needs a message or at least one photo/file." };
  }
  if (mediaUrls.length > 10) {
    return { ok: false, message: "Text messages can include at most 10 files (Twilio MMS limit)." };
  }

  // Hard stop for opted_out / provider_blocked at the Twilio boundary so no
  // automation, retry, or API path can bypass Inbox/scheduled checks.
  if (!payload.skipPermissionCheck) {
    const { createAdminClient } = await import("@/integrations/supabase/admin");
    const { assertChannelAllowed } = await import("@/lib/communication/permissions");
    const allowed = await assertChannelAllowed(createAdminClient(), {
      venueId: payload.venueId,
      channel: "sms",
      rawAddress: payload.to,
    });
    if (!allowed.ok) return { ok: false, message: allowed.message };
  }

  let recipient = payload.to;
  let sandboxRedirectedFrom: string | undefined;
  if (mode === "sandbox") {
    const sandboxTo = sandboxPhoneRecipient();
    if (!sandboxTo) {
      return {
        ok: false,
        message: "This environment isn't ready to send — the message was not delivered to a real recipient.",
      };
    }
    sandboxRedirectedFrom = payload.to;
    recipient = sandboxTo;
  }

  const params = new URLSearchParams({
    To: recipient,
    Body: payload.body,
    MessagingServiceSid: messagingServiceSid,
  });
  for (const url of mediaUrls) params.append("MediaUrl", url);

  // Communication Trust Experience — without this, Twilio has nothing to
  // call back to, so a "sent" text can never be told apart from one that
  // silently failed at the carrier. See app/api/messaging/sms-status/route.ts.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) params.set("StatusCallback", `${appUrl}/api/messaging/sms-status`);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioRestBasicAuth(secret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const data = await res.json().catch(() => null) as { sid?: string; message?: string } | null;
  if (!res.ok) {
    return { ok: false, message: data?.message ?? `Text send failed (${res.status}).` };
  }
  return {
    ok: true,
    providerId: data?.sid ?? "",
    providerAccountSid: account.twilioAccountSid,
    sandboxRedirectedFrom,
  };
}
