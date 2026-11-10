/**
 * Phase 6 — Refer a Venue program policy (configurable, not hardcoded into
 * unrelated billing logic).
 */

export const REFERRAL_POLICY_VERSION = "referral_v1";

export type ReferralProgramPolicy = {
  version: string;
  /** Days after first successful paid invoice before reward eligibility. */
  qualificationDays: number;
  recipient: "referring_venue";
  reward: "one_month_referrer_recurring_saas";
  application: "next_eligible_saas_invoice";
  cashEquivalent: false;
  currency: "usd";
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * Resolve active program policy from environment.
 * Default qualification window: 30 days (overridable via REFERRAL_QUALIFICATION_DAYS).
 */
export function getReferralProgramPolicy(): ReferralProgramPolicy {
  return {
    version:
      process.env.REFERRAL_POLICY_VERSION?.trim() || REFERRAL_POLICY_VERSION,
    qualificationDays: parsePositiveInt(
      process.env.REFERRAL_QUALIFICATION_DAYS,
      30,
    ),
    recipient: "referring_venue",
    reward: "one_month_referrer_recurring_saas",
    application: "next_eligible_saas_invoice",
    cashEquivalent: false,
    currency: "usd",
  };
}

export function addDaysIso(iso: string, days: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`invalid_iso:${iso}`);
  return new Date(ms + days * 24 * 60 * 60 * 1000).toISOString();
}
