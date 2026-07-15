/**
 * SMS sending utility, mirroring lib/email/send.ts's shape and fallback
 * discipline (2026-07-11 — SMS added ahead of launch).
 *
 * Uses the Twilio REST API directly via fetch (no SDK dependency, matching
 * how Resend is called elsewhere in this codebase) when Twilio env vars are
 * configured. Unlike email, there is no "safe" fallback for SMS — texting
 * has no mailto-style client-side alternative — so an unconfigured send
 * returns a clear ok:false rather than pretending to succeed.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN                — server only, never expose to browser
 *   TWILIO_MESSAGING_SERVICE_SID     — preferred: a Messaging Service gets
 *                                      Twilio's built-in STOP/START/HELP
 *                                      opt-out compliance handling for free.
 *   TWILIO_FROM_NUMBER               — fallback if no Messaging Service is
 *                                      set up yet; opt-out handling must be
 *                                      built separately if used long-term.
 *
 * See lib/communication/mode.ts for COMMUNICATION_MODE (real/sandbox/
 * disabled) and COMMUNICATION_SANDBOX_PHONE — Communication Infrastructure
 * Readiness, Phase 2.
 */

import { getCommunicationMode, sandboxPhoneRecipient } from "@/lib/communication/mode";

export type SmsPayload = {
  to: string;      // E.164 format, e.g. "+16155551234"
  body: string;
};

export type SmsSendResult =
  | { ok: true; providerId: string; sandboxRedirectedFrom?: string }
  | { ok: false; message: string };

function isConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER));
}

export async function sendSms(payload: SmsPayload): Promise<SmsSendResult> {
  const mode = getCommunicationMode();
  if (mode === "disabled") {
    return { ok: true, providerId: "disabled" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !(messagingServiceSid || fromNumber)) {
    return { ok: false, message: "Texting isn't configured for this venue yet — add Twilio credentials to enable it." };
  }
  if (!payload.to.trim()) {
    return { ok: false, message: "No phone number on file to text." };
  }

  let recipient = payload.to;
  let sandboxRedirectedFrom: string | undefined;
  if (mode === "sandbox") {
    const sandboxTo = sandboxPhoneRecipient();
    if (sandboxTo) {
      sandboxRedirectedFrom = payload.to;
      recipient = sandboxTo;
    }
  }

  const params = new URLSearchParams({
    To: recipient,
    Body: payload.body,
  });
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else params.set("From", fromNumber!);

  // Communication Trust Experience — without this, Twilio has nothing to
  // call back to, so a "sent" text can never be told apart from one that
  // silently failed at the carrier. See app/api/messaging/sms-status/route.ts.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) params.set("StatusCallback", `${appUrl}/api/messaging/sms-status`);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => null) as { sid?: string; message?: string } | null;
  if (!res.ok) {
    return { ok: false, message: data?.message ?? `Text send failed (${res.status}).` };
  }
  return { ok: true, providerId: data?.sid ?? "", sandboxRedirectedFrom };
}

export { isConfigured as isSmsConfigured };
