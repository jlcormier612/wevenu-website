/**
 * Phase 6 referral notifications to the referring venue.
 * Never contacts the referred prospect.
 * Sandbox redirects exclusively via COMMUNICATION_SANDBOX_EMAIL.
 */

import "server-only";

import { sendEmail } from "@/lib/email/send";
import { formatUsdFromCents } from "@shared/pricing";

export async function notifyReferralRewardEarned(input: {
  toEmail: string | null | undefined;
  venueName: string;
  amountCents: number;
  referredVenueName: string;
}): Promise<void> {
  if (!input.toEmail?.trim()) return;
  await sendEmail({
    to: input.toEmail.trim(),
    subject: "Your Hello to Cheers thank-you credit is ready",
    text: [
      `Hi ${input.venueName},`,
      "",
      `Thanks again for referring ${input.referredVenueName}.`,
      `Your one-time thank-you credit of ${formatUsdFromCents(input.amountCents)} is ready and will appear on your next eligible Hello to Cheers subscription invoice.`,
      "",
      "You can review status anytime under Settings → Refer a Venue.",
      "",
      "— Hello to Cheers",
    ].join("\n"),
  });
}

export async function notifyReferralRewardApplied(input: {
  toEmail: string | null | undefined;
  venueName: string;
  amountCents: number;
  invoiceId: string;
}): Promise<void> {
  if (!input.toEmail?.trim()) return;
  await sendEmail({
    to: input.toEmail.trim(),
    subject: "Your Hello to Cheers thank-you credit was applied",
    text: [
      `Hi ${input.venueName},`,
      "",
      `Your ${formatUsdFromCents(input.amountCents)} Refer a Venue thank-you credit was applied to invoice ${input.invoiceId}.`,
      "",
      "You can review details under Settings → Subscription & Billing.",
      "",
      "— Hello to Cheers",
    ].join("\n"),
  });
}
