/**
 * Communication Trust Experience — Phase 3 (+ email failure guidance).
 *
 * Provider error strings are never shown raw when we can classify them.
 * Unrecognized input falls back to an honest unknown line — never a fabricated
 * bounce/reject/temporary claim. Callers may still store richer diagnostics
 * in message_events for support.
 */

import {
  classifyResendBounceGuidance,
  classifyResendHttpFailureGuidance,
  emailFailureReasonForStorage,
  parseResendErrorBody,
  resolveEmailFailureGuidance,
  type ResendBounceFields,
} from "@/lib/communication/email-failure-guidance";

export function translateEmailFailure(raw: string): string {
  const s = (raw || "").trim();
  if (!s) {
    return resolveEmailFailureGuidance(null).explanation;
  }

  // Structured bounce marker produced by the webhook path.
  if (s.startsWith("BOUNCE_JSON:")) {
    try {
      const bounce = JSON.parse(s.slice("BOUNCE_JSON:".length)) as ResendBounceFields;
      return emailFailureReasonForStorage(classifyResendBounceGuidance(bounce));
    } catch {
      return resolveEmailFailureGuidance(null).explanation;
    }
  }

  // Resend HTTP JSON (or legacy "Email send failed: {...}").
  const parsed = parseResendErrorBody(s);
  if (parsed.statusCode || parsed.name || /email send failed:\s*\{/i.test(s)) {
    const status = parsed.statusCode ?? 400;
    const body = s.includes("{") ? (s.match(/\{[\s\S]*\}/)?.[0] ?? s) : s;
    return emailFailureReasonForStorage(
      classifyResendHttpFailureGuidance({ status, bodyText: body }),
    );
  }

  // Unstructured provider fragments (tests + older logs).
  const lower = s.toLowerCase();
  if (lower.includes("invalid") && (lower.includes("to") || lower.includes("recipient") || lower.includes("email"))) {
    return emailFailureReasonForStorage(
      classifyResendHttpFailureGuidance({
        status: 422,
        bodyText: JSON.stringify({ name: "validation_error", message: s }),
      }),
    );
  }
  if (lower.includes("domain") && (lower.includes("not verified") || lower.includes("not found") || lower.includes("dns"))) {
    return emailFailureReasonForStorage(
      classifyResendHttpFailureGuidance({
        status: 403,
        bodyText: JSON.stringify({ message: s }),
      }),
    );
  }

  return resolveEmailFailureGuidance(s).explanation;
}

/** Build a persistable bounce reason from structured Resend bounce fields. */
export function translateEmailBounceFailure(bounce: ResendBounceFields | null | undefined): string {
  return emailFailureReasonForStorage(classifyResendBounceGuidance(bounce));
}

export function translateSmsFailure(raw: string): string {
  const s = raw.toLowerCase();
  // Twilio error 21211
  if (s.includes("21211") || (s.includes("invalid") && s.includes("phone"))) {
    return "This phone number appears invalid.";
  }
  // Twilio error 21614 — not SMS-capable (landline, VOIP without messaging, etc.)
  if (s.includes("21614") || s.includes("not sms") || s.includes("not a valid mobile") || s.includes("not sms-capable")) {
    return "This phone number cannot receive text messages.";
  }
  // Twilio error 21610 — recipient has opted out (STOP)
  if (s.includes("21610") || s.includes("unsubscribed") || s.includes("opted out")) {
    return "This contact has opted out of text messages.";
  }
  if (s.includes("couldn't be sent") || s.includes("couldn’t be sent")) {
    return "Your message couldn’t be sent. Please try again.";
  }
  if (
    s.includes("isn't configured")
    || s.includes("not configured")
    || s.includes("isn't set up")
    || s.includes("isn’t set up")
    || s.includes("isn't available")
    || s.includes("communication health")
    || s.includes("settings")
  ) {
    return "Texting isn’t set up yet for your venue. Enable it in Settings → Communications.";
  }
  // Twilio error 30003 / undelivered — unreachable handset
  if (s.includes("30003") || s.includes("unreachable") || s.includes("handset")) {
    return "The recipient's number could not receive this message.";
  }
  // Twilio error 30005 / 30006 — unknown / landline destination
  if (s.includes("30005") || s.includes("30006") || s.includes("landline")) {
    return "The recipient's number could not receive this message.";
  }
  if (s.includes("no phone number") || s.includes("no phone")) {
    return "There's no phone number on file for this client.";
  }
  return "Your message couldn't be delivered.";
}
