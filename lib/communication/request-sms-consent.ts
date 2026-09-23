/**
 * Venue-initiated SMS consent request for contacts who are not_opted_in.
 *
 * COMPLIANCE GATE (RCJ human-facing cleanup):
 * Sending an unsolicited SMS merely to obtain SMS consent is not an acceptable
 * default. This function refuses to send. Public inquiry/tour checkbox + START
 * keyword remain the supported opt-in paths. Email solicitation is OPEN pending
 * legal basis (docs/qa/human-facing-cleanup/STATUS.md).
 *
 * Kept as a named export so accidental call sites fail closed with a clear message
 * rather than silently resurrecting the old SMS solicitation path.
 */

export type RequestSmsConsentResult =
  | { ok: true; providerId: string; pending: true }
  | { ok: false; message: string };

export async function requestSmsConsentForLead(_leadId: string): Promise<RequestSmsConsentResult> {
  return {
    ok: false,
    message:
      "Hello to Cheers does not send an unsolicited text to ask for permission. Use the public inquiry/tour SMS opt-in, or wait until they reply START to a message they already receive through a permitted channel.",
  };
}

/** Test helper — documents that the old SMS solicitation body is gone. */
export const SMS_CONSENT_SOLICITATION_DISABLED = true;
