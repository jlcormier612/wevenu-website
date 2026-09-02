/**
 * Conversation outbound delivery — only a real provider accept is success.
 * mailto / disabled / missing sandbox redirect must never be recorded as sent.
 */
import { translateEmailFailure, translateSmsFailure } from "@/lib/communication/failure-messages";
import type { SendResult } from "@/lib/email/send";
import type { SmsSendResult } from "@/lib/sms/send";

export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "Email isn't fully configured yet — Hello to Cheers can't send from here until email is set up.";
export const SMS_NOT_CONFIGURED_MESSAGE =
  "Texting isn't set up yet — Hello to Cheers can't send a text until texting is configured.";
export const SENDING_DISABLED_MESSAGE =
  "Sending is turned off in this environment.";

export function acceptOutboundEmail(
  result: SendResult,
): { ok: true; providerId: string } | { ok: false; message: string } {
  if (!result.ok) return { ok: false, message: translateEmailFailure(result.message) };
  if (result.method === "resend") {
    return { ok: true, providerId: result.providerId ?? "" };
  }
  if (result.method === "mailto") {
    return { ok: false, message: EMAIL_NOT_CONFIGURED_MESSAGE };
  }
  return { ok: false, message: SENDING_DISABLED_MESSAGE };
}

export function acceptOutboundSms(
  result: SmsSendResult,
): { ok: true; providerId: string } | { ok: false; message: string } {
  if (!result.ok) return { ok: false, message: translateSmsFailure(result.message) };
  if (!result.providerId || result.providerId === "disabled") {
    return { ok: false, message: SENDING_DISABLED_MESSAGE };
  }
  return { ok: true, providerId: result.providerId };
}
