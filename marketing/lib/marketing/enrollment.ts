/**
 * Enrollment program configuration for Pricing + checkout.
 * Values come from environment — never hardcode in UI components.
 *
 * Founder Program: every new subscription receives Founding pricing
 * automatically while active and spots remain (no pre-purchase approval).
 *
 * Welcome Back: optional self-identification at pre-checkout
 * (`welcome_back`). Verification happens later in CRM — never during checkout.
 */

import {
  foundingSpotsRemainingForDisplay,
  isPricingLaunchV1Ready,
  requireDurablePricingOfferStore,
} from "@shared/pricing";
import {
  getFounderProgramCapacity,
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
  resolveFounderSpotsRemaining,
  warmLiveStore,
} from "@shared/relationships";

export type EnrollmentConfig = {
  founderProgramActive: boolean;
  founderSpotsRemaining: number;
  /** Distinct venues that have earned Founding (may exceed soft capacity). */
  foundingEarnedCount?: number;
};

/** Onboarding choice passed through checkout metadata (selection UI lives elsewhere). */
export type OnboardingType = "self_guided" | "white_glove";

export type WelcomeBackVerifiedStatus =
  | "none"
  | "pending"
  | "verified"
  | "rejected";

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

/**
 * Reads enrollment flags from the environment (+ live founding count when available).
 * Remaining spots prefer capacity − live founding members (auto-decrements with sales).
 * Falls back to `FOUNDER_SPOTS_REMAINING`, then full capacity.
 *
 * Prefer `await getEnrollmentConfigAsync()` on server pages so Postgres CRM is warm.
 */
export function getEnrollmentConfig(): EnrollmentConfig {
  const founderProgramActive = parseBooleanFlag(
    process.env.FOUNDER_PROGRAM_ACTIVE,
    true,
  );
  const capacity = getFounderProgramCapacity();

  // Launch V1: remaining display is driven by earned founding grants (soft 100).
  // Abandoned Checkouts are not counted. Actual earned may later exceed capacity.
  if (isPricingLaunchV1Ready()) {
    try {
      // Memory/Postgres store — sync count via deasync-free best effort:
      // callers that need durable accuracy should use getEnrollmentConfigAsync.
      const cached = (globalThis as { __htcFoundingEarnedCount?: number })
        .__htcFoundingEarnedCount;
      if (typeof cached === "number") {
        return {
          founderProgramActive,
          founderSpotsRemaining: foundingSpotsRemainingForDisplay(cached, capacity),
          foundingEarnedCount: cached,
        };
      }
    } catch {
      /* fall through */
    }
  }

  let foundingCount: number | undefined;
  try {
    if (hasLiveRelationshipsSync()) {
      const store = loadLiveStoreSync();
      foundingCount = store.relationships.filter((r) => r.foundingMember).length;
    }
  } catch {
    foundingCount = undefined;
  }

  return {
    founderProgramActive,
    founderSpotsRemaining: resolveFounderSpotsRemaining({
      foundingCount,
      capacity,
    }),
    foundingEarnedCount: foundingCount,
  };
}

/** Server-side: warm durable CRM / grant store then return enrollment config. */
export async function getEnrollmentConfigAsync(): Promise<EnrollmentConfig> {
  if (isPricingLaunchV1Ready()) {
    try {
      const consumed =
        await requireDurablePricingOfferStore().countConsumedFoundingAllocations();
      (globalThis as { __htcFoundingEarnedCount?: number }).__htcFoundingEarnedCount =
        consumed;
      const capacity = getFounderProgramCapacity();
      return {
        founderProgramActive: parseBooleanFlag(
          process.env.FOUNDER_PROGRAM_ACTIVE,
          true,
        ),
        founderSpotsRemaining: foundingSpotsRemainingForDisplay(
          consumed,
          capacity,
        ),
        foundingEarnedCount: consumed,
      };
    } catch (error) {
      console.error("[enrollment] durable founding count unavailable", {
        error: error instanceof Error ? error.message : String(error),
      });
      /* fall through to CRM relationship count for display only */
    }
  }

  try {
    await warmLiveStore();
  } catch {
    /* founder spots fall back to env */
  }
  return getEnrollmentConfig();
}

/** True while the Founder Program should drive public pricing display. */
export function isFounderPricingActive(config: EnrollmentConfig = getEnrollmentConfig()): boolean {
  return config.founderProgramActive && config.founderSpotsRemaining > 0;
}

/**
 * New subscriptions receive Founding Member status automatically while
 * Founder pricing is active (pre-100). After the program ends, they do not.
 */
export function isAutomaticFoundingMember(
  config: EnrollmentConfig = getEnrollmentConfig(),
): boolean {
  return isFounderPricingActive(config);
}

export function isOnboardingType(value: string): value is OnboardingType {
  return value === "self_guided" || value === "white_glove";
}

export function parseOnboardingType(
  value: string | null | undefined,
  fallback: OnboardingType = "self_guided",
): OnboardingType {
  if (value && isOnboardingType(value)) return value;
  return fallback;
}

export function parseWelcomeBackRequested(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

export function onboardingLabel(type: OnboardingType): "Self-Setup" | "White Glove Setup" {
  return type === "white_glove" ? "White Glove Setup" : "Self-Setup";
}

export function yesNo(value: boolean): "Yes" | "No" {
  return value ? "Yes" : "No";
}
