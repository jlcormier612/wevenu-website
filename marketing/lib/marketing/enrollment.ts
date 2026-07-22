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
  getFounderProgramCapacity,
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
  resolveFounderSpotsRemaining,
} from "@shared/relationships";

export type EnrollmentConfig = {
  founderProgramActive: boolean;
  founderSpotsRemaining: number;
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
 */
export function getEnrollmentConfig(): EnrollmentConfig {
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
    founderProgramActive: parseBooleanFlag(process.env.FOUNDER_PROGRAM_ACTIVE, true),
    founderSpotsRemaining: resolveFounderSpotsRemaining({
      foundingCount,
      capacity: getFounderProgramCapacity(),
    }),
  };
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

export function onboardingLabel(type: OnboardingType): "Self-Guided" | "White Glove" {
  return type === "white_glove" ? "White Glove" : "Self-Guided";
}

export function yesNo(value: boolean): "Yes" | "No" {
  return value ? "Yes" : "No";
}
