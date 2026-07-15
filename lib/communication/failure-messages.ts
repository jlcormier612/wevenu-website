/**
 * Communication Trust Experience — Phase 3.
 *
 * Provider error strings (Resend's JSON error bodies, Twilio's error
 * messages/codes) are never shown to a venue owner directly — "422
 * validation_error: Invalid `to` field" doesn't answer "did my message go?"
 * for anyone who isn't an email administrator. Each raw message is matched
 * against the failure shapes we actually know how to explain; anything
 * unrecognized falls back to an honest, generic line rather than a
 * confusing technical one. The raw text is never discarded — callers
 * should still store it (e.g. `message_events.payload`) for the
 * diagnostics view (Phase 7); this only governs what the coordinator sees.
 */

export function translateEmailFailure(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("invalid") && (s.includes("to") || s.includes("recipient") || s.includes("email"))) {
    return "This email address appears invalid.";
  }
  if (s.includes("domain") && (s.includes("not verified") || s.includes("not found") || s.includes("dns"))) {
    return "Your venue's email isn't fully set up yet — contact support.";
  }
  if (s.includes("rate limit") || s.includes("429")) {
    return "Too many messages were sent at once — this one will be retried shortly.";
  }
  if (s.includes("isn't configured") || s.includes("not configured")) {
    return "Email isn't set up for this venue yet.";
  }
  return "Your message couldn't be delivered.";
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
    return "This client has opted out of text messages.";
  }
  if (s.includes("isn't configured") || s.includes("not configured")) {
    return "Texting isn't set up for this venue yet.";
  }
  if (s.includes("no phone number") || s.includes("no phone")) {
    return "There's no phone number on file for this client.";
  }
  return "Your message couldn't be delivered.";
}
