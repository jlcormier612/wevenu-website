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
    subject: "You've earned a FREE month of Hello to Cheers!",
    category: "referral",
    priority: "critical",
    text: [
      "Great news!",
      "",
      "Your referral has qualified for a reward, and you've earned a subscription credit equal to one month of your Hello to Cheers subscription.",
      "",
      "Your credit is now available and will be applied toward your next eligible subscription invoice.",
      "",
      "Thank you for introducing another venue to Hello to Cheers. We're so grateful to have you as part of our community.",
      "",
      "And remember — there's no limit to the number of qualifying referrals you can make.",
      "",
      "Keep sharing. Keep earning.",
      "",
      "Cheers!",
      "",
      "The Hello to Cheers Team",
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
    subject: "Your Hello to Cheers referral credit was applied",
    category: "referral",
    priority: "critical",
    text: [
      `Hi ${input.venueName},`,
      "",
      `Your ${formatUsdFromCents(input.amountCents)} Refer a Venue subscription credit was applied to invoice ${input.invoiceId}.`,
      "",
      "You can review details under Settings → Subscription & Billing.",
      "",
      "Keep sharing. Keep earning.",
      "",
      "— The Hello to Cheers Team",
    ].join("\n"),
  });
}
