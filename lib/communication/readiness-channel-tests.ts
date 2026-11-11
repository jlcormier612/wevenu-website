/**
 * Pure Communication Readiness rows for channel test evidence.
 * Kept separate from readiness.ts so unit tests do not load server clients.
 */
import type { ReadinessItem } from "@/lib/communication/readiness-types";

export type { ReadinessItem, ReadinessState } from "@/lib/communication/readiness-types";

/** Pure channel-test checklist rows — email success must never imply SMS success. */
export function buildChannelTestReadinessItems(input: {
  emailTested: boolean;
  smsTested: boolean;
  smsConfigured: boolean;
}): ReadinessItem[] {
  const { emailTested, smsTested, smsConfigured } = input;
  return [
    {
      key: "test_email",
      label: "Test email successful",
      state: emailTested ? "ready" : "untested",
      detail: emailTested
        ? "A test email was accepted by the email provider."
        : "Send yourself a test email below to confirm the email provider accepts it.",
    },
    {
      key: "test_sms",
      label: "Test text successful",
      state: !smsConfigured ? "untested" : smsTested ? "ready" : "untested",
      detail: !smsConfigured
        ? "Not applicable — texting is not enabled for this venue. Enable it in Settings → Communications before testing texts."
        : smsTested
          ? "A test text was accepted by the texting provider."
          : "Send yourself a test text below to confirm the texting provider accepts it.",
    },
  ];
}

/** Whether a readiness item blocks the overall “Communication Ready” banner. */
export function readinessItemCountsTowardAllReady(
  item: ReadinessItem,
  smsConfigured: boolean,
): boolean {
  if (item.key === "test_sms" && !smsConfigured) return false;
  return true;
}
