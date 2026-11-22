import type { VenueEnrollmentRecord } from "./types";
import { onboardingLabel, yesNo } from "../marketing/enrollment";
import { getPlanDisplayName } from "../marketing/onboarding-packages";
import { formatUsdFromCents } from "@shared/pricing";
import { activationBaseUrl } from "@shared/email";

export type EnrollmentNotifyContext = {
  relationshipId?: string | null;
};

function formatUsd(cents: number | null | undefined): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents < 0) {
    return null;
  }
  return formatUsdFromCents(cents);
}

/** Human-readable summary lines for ops subscription notifications. */
export function enrollmentSummaryLines(
  record: VenueEnrollmentRecord,
  context: EnrollmentNotifyContext = {},
): string[] {
  const purchaserName = [record.customerFirstName, record.customerLastName]
    .map((p) => p?.trim() || "")
    .filter(Boolean)
    .join(" ");
  const onboarding = onboardingLabel(record.onboardingType);
  const isWhiteGlove = record.onboardingType === "white_glove";
  const mrrLabel = formatUsd(record.mrrCents ?? null);
  const wgAmountLabel = formatUsd(record.whiteGloveAmountCents ?? null);
  const discountName = record.discountName?.trim() || null;

  const nextAction = isWhiteGlove
    ? "White Glove: wait for customer intake (or follow up if overdue). Review the CRM relationship, then configure the venue in HQ after materials arrive — do not push self-serve Setup Hub."
    : "Customer should activate via Launch Yourself email. Confirm activation and Setup Hub progress in CRM/product.";

  const lines: string[] = [
    "A new Hello to Cheers subscription was enrolled after successful payment.",
    "",
    "Venue:",
    record.venueName,
    "",
    "Purchaser:",
    purchaserName || "—",
    "",
    "Contact email:",
    record.customerEmail || "—",
    "",
    "Subscription tier:",
    record.planName || getPlanDisplayName(record.plan),
    "",
    "Monthly recurring (after discount):",
    mrrLabel || "—",
    "",
    "Discount:",
    discountName || "None",
    "",
    "Onboarding choice:",
    onboarding,
  ];

  if (isWhiteGlove) {
    lines.push(
      "",
      "White Glove purchase:",
      "Yes",
      "",
      "White Glove one-time amount:",
      wgAmountLabel || "—",
    );
  } else {
    lines.push("", "White Glove purchase:", yesNo(false));
  }

  lines.push(
    "",
    "Payment:",
    record.paymentStatus === "successful" ? "Successful" : record.paymentStatus,
    "",
    "Enrollment id:",
    record.id,
    "",
    "Checkout session:",
    record.stripeCheckoutSessionId || "—",
    "",
    "Stripe customer:",
    record.stripeCustomerId || "—",
    "",
    "Subscription:",
    record.stripeSubscriptionId || "—",
    "",
    "Purchase date:",
    record.createdAt,
    "",
    "Next action:",
    nextAction,
  );

  const relationshipId = context.relationshipId?.trim();
  if (relationshipId) {
    const crmUrl = `${activationBaseUrl()}/relationships/${encodeURIComponent(relationshipId)}`;
    lines.push("", "CRM relationship:", crmUrl);
  }

  return lines;
}
