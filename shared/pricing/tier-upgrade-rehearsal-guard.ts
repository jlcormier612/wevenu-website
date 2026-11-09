/**
 * Fixture-only authorization for Phase 3 rehearsal paths.
 *
 * Global TIER_UPGRADE_APPLY_STRIPE / TIER_UPGRADE_SEND_NOTICE remain OFF.
 * Rehearsal actions are allowed only when Stripe Customer + Subscription both
 * carry metadata htc_phase3_rehearsal=true (and optional venue allowlist).
 */

export type StripeMetadataEntity = {
  id: string;
  metadata?: Record<string, string> | null;
};

export function isPhase3RehearsalMetadata(
  entity: StripeMetadataEntity | null | undefined,
): boolean {
  const meta = entity?.metadata ?? {};
  return meta.htc_phase3_rehearsal === "true";
}

export function assertPhase3RehearsalFixture(input: {
  venueId: string;
  customer: StripeMetadataEntity | null;
  subscription: StripeMetadataEntity | null;
}): { ok: true } | { ok: false; reason: string } {
  const allowlist = (process.env.TIER_UPGRADE_REHEARSAL_VENUE_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(input.venueId)) {
    return {
      ok: false,
      reason: `Venue ${input.venueId} is not in TIER_UPGRADE_REHEARSAL_VENUE_IDS.`,
    };
  }
  if (!isPhase3RehearsalMetadata(input.customer)) {
    return {
      ok: false,
      reason:
        "Stripe Customer lacks metadata htc_phase3_rehearsal=true — refuse fixture-only mutation.",
    };
  }
  if (!isPhase3RehearsalMetadata(input.subscription)) {
    return {
      ok: false,
      reason:
        "Stripe Subscription lacks metadata htc_phase3_rehearsal=true — refuse fixture-only mutation.",
    };
  }
  return { ok: true };
}

/** True when global notice gate is on OR this is an authorized rehearsal fixture. */
export function maySendTierUpgradeNotice(input: {
  isRehearsalFixture: boolean;
}): boolean {
  if (process.env.TIER_UPGRADE_SEND_NOTICE === "true") return true;
  return input.isRehearsalFixture;
}

/** True when global apply gate is on OR this is an authorized rehearsal fixture. */
export function mayApplyTierUpgradeStripe(input: {
  isRehearsalFixture: boolean;
}): boolean {
  if (process.env.TIER_UPGRADE_APPLY_STRIPE === "true") return true;
  return input.isRehearsalFixture;
}
