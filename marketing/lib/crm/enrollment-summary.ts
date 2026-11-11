import type { VenueEnrollmentRecord } from "./types";
import { onboardingLabel, yesNo } from "../marketing/enrollment";
import { getPlanDisplayName } from "../marketing/onboarding-packages";

/** Human-readable summary lines for ops subscription notifications. */
export function enrollmentSummaryLines(record: VenueEnrollmentRecord): string[] {
  const purchaserName = [record.customerFirstName, record.customerLastName]
    .map((p) => p?.trim() || "")
    .filter(Boolean)
    .join(" ");
  const onboarding = onboardingLabel(record.onboardingType);
  const isWhiteGlove = record.onboardingType === "white_glove";
  const discounts: string[] = [];
  if (record.foundingMember) discounts.push("Founding member flag");
  if (record.welcomeBackRequested) discounts.push("Welcome Back / Weven claim");
  const nextAction = isWhiteGlove
    ? "Wait for White Glove intake (or follow up if overdue). Review CRM relationship, then configure in HQ after materials arrive."
    : "Customer should activate via Launch Yourself email. Confirm activation and Setup Hub progress in CRM/product.";

  return [
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
    "Onboarding choice:",
    onboarding,
    "",
    "White Glove purchase:",
    yesNo(isWhiteGlove),
    "",
    "Applicable discounts / claims:",
    discounts.length > 0 ? discounts.join("; ") : "None noted on enrollment",
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
  ];
}
