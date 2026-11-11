/**
 * Pure helpers for Communication Readiness test-send UX and result messaging.
 */

export function isSmsTestActionAvailable(input: {
  smsConfigured: boolean;
  venuePhone: string | null | undefined;
}): boolean {
  return Boolean(input.smsConfigured && input.venuePhone?.trim());
}

export function isEmailTestActionAvailable(input: {
  emailConfigured: boolean;
  venueEmail: string | null | undefined;
}): boolean {
  return Boolean(input.emailConfigured && input.venueEmail?.trim());
}

export function formatTestEmailSuccessMessage(input: {
  venueEmail: string;
  sandboxRedirected: boolean;
  sandboxInbox: string | null;
}): string {
  if (input.sandboxRedirected) {
    const inbox = input.sandboxInbox?.trim();
    return inbox
      ? `Test email accepted by the email provider and routed to the Sandbox test inbox (${inbox}).`
      : "Test email accepted by the email provider and routed to the Sandbox test inbox.";
  }
  return `Test email accepted by the email provider for ${input.venueEmail}. Delivery confirmation comes later from the provider — this is not the same as Delivered.`;
}

export const SMS_TEST_NOT_CONFIGURED_MESSAGE =
  "Texting isn’t set up yet for your venue — enable text messaging in Settings → Communications.";
