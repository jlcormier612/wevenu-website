/**
 * Narrow B headcount helpers.
 *
 * B1: new Event Order apply/seed uses `boundHeadcountForApply` (Guaranteed ?? Estimated).
 * B2: recalc of open / unshared / unapproved bound lines when the bound count changes.
 */
import { resolveHtcDeployEnvironment } from "@/lib/sms/venue-twilio-runtime";

/**
 * Recalc gate for B2+. Production stays off unless explicitly enabled.
 * Sandbox / test default on so B2 proofs exercise the living path.
 */
export function headcountRecalcEnabled(): boolean {
  const raw = process.env.HEADCOUNT_RECALC_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  const env = resolveHtcDeployEnvironment();
  return env === "sandbox" || process.env.NODE_ENV === "test";
}

/** Estimated = today's `events.guest_count` (no rename). */
export function estimatedHeadcount(guestCount: number | null | undefined): number | null {
  if (guestCount == null || !Number.isFinite(guestCount)) return null;
  const n = Math.trunc(guestCount);
  return n >= 0 ? n : null;
}

/** Optional Guaranteed column. */
export function guaranteedHeadcount(
  guaranteedGuestCount: number | null | undefined,
): number | null {
  if (guaranteedGuestCount == null || !Number.isFinite(guaranteedGuestCount)) return null;
  const n = Math.trunc(guaranteedGuestCount);
  return n >= 0 ? n : null;
}

/**
 * Bound count for new apply/seed (B1+): Guaranteed if set, else Estimated.
 * Do not use this to rewrite existing EO line quantities until B2.
 */
export function boundHeadcountForApply(
  estimated: number | null | undefined,
  guaranteed: number | null | undefined,
): number | null {
  return guaranteedHeadcount(guaranteed) ?? estimatedHeadcount(estimated);
}
