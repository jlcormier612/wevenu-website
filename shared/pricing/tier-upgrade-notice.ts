/**
 * Venue-facing upgrade notice draft (no send during local Phase 3).
 */

import { formatUsdFromCents, getCatalogEntry } from "./catalog";
import { buildNoticeIdempotencyKey } from "./tier-upgrade-evaluate";
import type { TierUpgradeNoticeDraft, TierUpgradeRecord } from "./tier-upgrade-types";

function formatFriendlyDate(iso: string | null): string {
  if (!iso) return "your next eligible renewal";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "your next eligible renewal";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function buildTierUpgradeNoticeDraft(input: {
  upgrade: TierUpgradeRecord;
  venueName: string;
  contactEmail?: string;
}): TierUpgradeNoticeDraft {
  const current = getCatalogEntry(input.upgrade.currentPlanKey);
  const next = getCatalogEntry(input.upgrade.requiredPlanKey);
  const effective = input.upgrade.scheduledEffectiveAt;
  const idempotencyKey =
    input.upgrade.noticeIdempotencyKey ??
    buildNoticeIdempotencyKey(input.upgrade.id, effective ?? input.upgrade.id);

  const discountLabel =
    input.upgrade.appliedPercentOff && input.upgrade.appliedOfferType
      ? input.upgrade.appliedOfferType === "weven_pct"
        ? "Your Former Weven 20% lifetime discount continues."
        : input.upgrade.appliedOfferType === "founding_pct"
          ? "Your Founding Member 10% lifetime discount continues."
          : `Your ${input.upgrade.appliedPercentOff}% lifetime discount continues.`
      : "Standard subscription pricing applies.";

  return {
    templateId: "tier_upgrade_notice",
    subject: "Your Hello to Cheers plan is growing with you",
    vars: {
      venue_name: input.venueName,
      current_plan_name: current.name,
      new_plan_name: next.name,
      effective_date: formatFriendlyDate(effective),
      current_amount: formatUsdFromCents(input.upgrade.currentListAmountCents),
      new_amount: formatUsdFromCents(input.upgrade.expectedRecurringAmountCents),
      discount_label: discountLabel,
      peak_count: String(input.upgrade.peakCount),
      peak_year: String(input.upgrade.peakYear),
      contact_email: input.contactEmail ?? "jennifer@hellotocheers.com",
    },
    idempotencyKey,
  };
}

export function renderTierUpgradeNoticeBody(draft: TierUpgradeNoticeDraft): string {
  const v = draft.vars;
  return [
    `Hi ${v.venue_name},`,
    "",
    `Your venue has reached the booking volume for our ${v.new_plan_name} plan (${v.peak_count} qualifying celebrations in ${v.peak_year}).`,
    "",
    `Your subscription will move from ${v.current_plan_name} to ${v.new_plan_name} at your next eligible renewal on ${v.effective_date}.`,
    "",
    `Current recurring subscription: ${v.current_amount}/month`,
    `New recurring subscription: ${v.new_amount}/month`,
    v.discount_label,
    "",
    "There is no immediate charge. Your current plan and billing amount stay the same until that renewal date.",
    "",
    `Questions? Reply to this email or contact ${v.contact_email}.`,
    "",
    "With care,",
    "Hello to Cheers",
  ].join("\n");
}
