/**
 * Fixture-only authorization for Phase 3 controlled testing.
 *
 * Global TIER_UPGRADE_APPLY_STRIPE / TIER_UPGRADE_SEND_NOTICE remain the
 * production-style gates and default OFF.
 *
 * Stripe metadata `htc_phase3_rehearsal=true` alone must NEVER authorize a
 * notice send or Stripe mutation. Fixture execution additionally requires the
 * explicit, default-off env flag `TIER_UPGRADE_REHEARSAL_ENABLED=true` plus
 * optional venue allowlist.
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

export function isPhase3RehearsalExecutionEnabled(): boolean {
  return process.env.TIER_UPGRADE_REHEARSAL_ENABLED === "true";
}

export function assertPhase3RehearsalFixture(input: {
  venueId: string;
  customer: StripeMetadataEntity | null;
  subscription: StripeMetadataEntity | null;
}): { ok: true } | { ok: false; reason: string } {
  if (!isPhase3RehearsalExecutionEnabled()) {
    return {
      ok: false,
      reason:
        "TIER_UPGRADE_REHEARSAL_ENABLED is not true — fixture-only notice/apply paths are disabled.",
    };
  }
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

/**
 * True when global notice gate is on, OR rehearsal execution is explicitly
 * enabled and the caller already verified a rehearsal fixture.
 */
export function maySendTierUpgradeNotice(input: {
  isRehearsalFixture: boolean;
}): boolean {
  if (process.env.TIER_UPGRADE_SEND_NOTICE === "true") return true;
  return isPhase3RehearsalExecutionEnabled() && input.isRehearsalFixture;
}

/**
 * True when global apply gate is on, OR rehearsal execution is explicitly
 * enabled and the caller already verified a rehearsal fixture.
 */
export function mayApplyTierUpgradeStripe(input: {
  isRehearsalFixture: boolean;
}): boolean {
  if (process.env.TIER_UPGRADE_APPLY_STRIPE === "true") return true;
  return isPhase3RehearsalExecutionEnabled() && input.isRehearsalFixture;
}
