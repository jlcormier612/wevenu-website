/**
 * Pricing Launch V1 readiness — tri-state across marketing + Checkout.
 *
 * - legacy: PRICING_LAUNCH_V1 off → existing Sandbox pricing
 * - v1_ready: flag on + complete Stripe config → advertise and sell V1
 * - v1_misconfigured: flag on + incomplete config → fail closed
 *   (never silently fall back to legacy $149 / $30 coupon)
 */

function readEnvId(envName: string): string | null {
  const value = process.env[envName]?.trim();
  if (!value || value.endsWith("...")) return null;
  return value;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

/** Explicit launch flag. Default false — Sandbox keeps serving legacy pricing. */
export function isPricingLaunchV1FlagEnabled(): boolean {
  return parseBooleanFlag(process.env.PRICING_LAUNCH_V1, false);
}

/**
 * Gather $199 recurring Price for Launch V1.
 * Prefer dedicated env so legacy $149 Test Price can remain on STRIPE_GATHER_PRICE_ID
 * until cutover.
 */
export function resolveLaunchGatherPriceId(): string | null {
  return (
    readEnvId("STRIPE_PRICE_GATHER_199") ||
    readEnvId("STRIPE_GATHER_PRICE_ID_V1") ||
    // Allowed only when launch flag is intentionally pointing the canonical env at $199.
    readEnvId("STRIPE_GATHER_PRICE_ID")
  );
}

export function resolveLaunchCelebratePriceId(): string | null {
  return readEnvId("STRIPE_PRICE_GROWING") || readEnvId("STRIPE_PRICE_CELEBRATE");
}

export function resolveLaunchFlourishPriceId(): string | null {
  return (
    readEnvId("STRIPE_PRICE_PROFESSIONAL") || readEnvId("STRIPE_PRICE_FLOURISH")
  );
}

/** 10% forever Founding coupon — must NOT be the legacy $30 FOUNDING100 coupon. */
export function resolveLaunchFoundingPercentCouponId(): string | null {
  return (
    readEnvId("STRIPE_FOUNDING_PERCENT_COUPON_ID") ||
    readEnvId("STRIPE_FOUNDING_10_COUPON_ID")
  );
}

export function resolveLaunchWhiteGlovePriceId(): string | null {
  return readEnvId("STRIPE_PRICE_WHITE_GLOVE");
}

export type PricingLaunchMode = "legacy" | "v1_ready" | "v1_misconfigured";

export type PricingLaunchReadiness = {
  mode: PricingLaunchMode;
  ready: boolean;
  flagEnabled: boolean;
  missing: string[];
  gatherPriceId: string | null;
  celebratePriceId: string | null;
  flourishPriceId: string | null;
  foundingPercentCouponId: string | null;
  whiteGlovePriceId: string | null;
  /** Safe operational message (no secrets). */
  diagnosticMessage: string;
};

export function getPricingLaunchV1Readiness(): PricingLaunchReadiness {
  const flagEnabled = isPricingLaunchV1FlagEnabled();
  const gatherPriceId = resolveLaunchGatherPriceId();
  const celebratePriceId = resolveLaunchCelebratePriceId();
  const flourishPriceId = resolveLaunchFlourishPriceId();
  const foundingPercentCouponId = resolveLaunchFoundingPercentCouponId();
  const whiteGlovePriceId = resolveLaunchWhiteGlovePriceId();

  const missing: string[] = [];
  if (!gatherPriceId) {
    missing.push("STRIPE_PRICE_GATHER_199 (or STRIPE_GATHER_PRICE_ID_V1 / STRIPE_GATHER_PRICE_ID)");
  }
  if (!celebratePriceId) missing.push("STRIPE_PRICE_GROWING");
  if (!flourishPriceId) missing.push("STRIPE_PRICE_PROFESSIONAL");
  if (!foundingPercentCouponId) {
    missing.push("STRIPE_FOUNDING_PERCENT_COUPON_ID");
  }

  if (!flagEnabled) {
    return {
      mode: "legacy",
      ready: false,
      flagEnabled: false,
      missing: [],
      gatherPriceId,
      celebratePriceId,
      flourishPriceId,
      foundingPercentCouponId,
      whiteGlovePriceId,
      diagnosticMessage: "PRICING_LAUNCH_V1 is off — serving legacy pricing.",
    };
  }

  if (missing.length > 0) {
    return {
      mode: "v1_misconfigured",
      ready: false,
      flagEnabled: true,
      missing,
      gatherPriceId,
      celebratePriceId,
      flourishPriceId,
      foundingPercentCouponId,
      whiteGlovePriceId,
      diagnosticMessage: `Pricing Launch V1 is enabled but incomplete: missing ${missing.join(", ")}. Checkout is unavailable; legacy fallback is disabled.`,
    };
  }

  return {
    mode: "v1_ready",
    ready: true,
    flagEnabled: true,
    missing: [],
    gatherPriceId,
    celebratePriceId,
    flourishPriceId,
    foundingPercentCouponId,
    whiteGlovePriceId,
    diagnosticMessage: "Pricing Launch V1 is ready.",
  };
}

export function getPricingLaunchMode(
  readiness: PricingLaunchReadiness = getPricingLaunchV1Readiness(),
): PricingLaunchMode {
  return readiness.mode;
}

/** True only when marketing may advertise Launch V1 prices and Checkout may use them. */
export function isPricingLaunchV1Ready(
  readiness: PricingLaunchReadiness = getPricingLaunchV1Readiness(),
): boolean {
  return readiness.ready;
}

/** Flag on but config incomplete — fail closed; do not use legacy Checkout. */
export function isPricingLaunchV1Misconfigured(
  readiness: PricingLaunchReadiness = getPricingLaunchV1Readiness(),
): boolean {
  return readiness.mode === "v1_misconfigured";
}

export function requirePricingLaunchV1Ready(): PricingLaunchReadiness {
  const readiness = getPricingLaunchV1Readiness();
  if (!readiness.ready) {
    throw new Error(readiness.diagnosticMessage);
  }
  return readiness;
}

/**
 * Structured readiness signal for deployment verification / ops logs.
 * Never includes secret values — only presence and missing env names.
 */
export function getPricingLaunchOperationalSignal(): {
  mode: PricingLaunchMode;
  ready: boolean;
  flagEnabled: boolean;
  missing: string[];
  message: string;
  whiteGloveConfigured: boolean;
} {
  const readiness = getPricingLaunchV1Readiness();
  return {
    mode: readiness.mode,
    ready: readiness.ready,
    flagEnabled: readiness.flagEnabled,
    missing: readiness.missing,
    message: readiness.diagnosticMessage,
    whiteGloveConfigured: Boolean(readiness.whiteGlovePriceId),
  };
}

// ---------------------------------------------------------------------------
// Phase 2 — Former Weven offer gate (independent of Launch V1)
// ---------------------------------------------------------------------------

/** Explicit Phase 2 Weven flag. Default false — V1 Founding/standard unchanged. */
export function isPricingWevenV1FlagEnabled(): boolean {
  return parseBooleanFlag(process.env.PRICING_WEVEN_V1, false);
}

/** 20% forever Weven coupon — must NOT be the Founding 10% coupon. */
export function resolveWevenPercentCouponId(): string | null {
  return (
    readEnvId("STRIPE_WEVEN_PERCENT_COUPON_ID") ||
    readEnvId("STRIPE_WEVEN_20_COUPON_ID")
  );
}

/** One-time $399 White Glove Price for qualifying Weven venues. */
export function resolveWevenWhiteGlovePriceId(): string | null {
  return (
    readEnvId("STRIPE_PRICE_WHITE_GLOVE_WEVEN") ||
    readEnvId("STRIPE_PRICE_WHITE_GLOVE_WEVEN_399")
  );
}

export type PricingWevenMode = "disabled" | "weven_ready" | "weven_misconfigured";

export type PricingWevenReadiness = {
  mode: PricingWevenMode;
  ready: boolean;
  flagEnabled: boolean;
  missing: string[];
  wevenPercentCouponId: string | null;
  wevenWhiteGlovePriceId: string | null;
  diagnosticMessage: string;
};

/**
 * Phase 2 readiness — independent of Launch V1.
 * Misconfiguration must not disable standard/Founding Checkout.
 */
export function getPricingWevenV1Readiness(): PricingWevenReadiness {
  const flagEnabled = isPricingWevenV1FlagEnabled();
  const wevenPercentCouponId = resolveWevenPercentCouponId();
  const wevenWhiteGlovePriceId = resolveWevenWhiteGlovePriceId();

  const missing: string[] = [];
  if (!wevenPercentCouponId) missing.push("STRIPE_WEVEN_PERCENT_COUPON_ID");
  if (!wevenWhiteGlovePriceId) missing.push("STRIPE_PRICE_WHITE_GLOVE_WEVEN");

  if (!flagEnabled) {
    return {
      mode: "disabled",
      ready: false,
      flagEnabled: false,
      missing: [],
      wevenPercentCouponId,
      wevenWhiteGlovePriceId,
      diagnosticMessage:
        "PRICING_WEVEN_V1 is off — former Weven discounted Checkout is not advertised as purchasable.",
    };
  }

  if (missing.length > 0) {
    return {
      mode: "weven_misconfigured",
      ready: false,
      flagEnabled: true,
      missing,
      wevenPercentCouponId,
      wevenWhiteGlovePriceId,
      diagnosticMessage: `Former Weven offer is enabled but incomplete: missing ${missing.join(", ")}. Weven Checkout is unavailable; standard/Founding Checkout remains available.`,
    };
  }

  return {
    mode: "weven_ready",
    ready: true,
    flagEnabled: true,
    missing: [],
    wevenPercentCouponId,
    wevenWhiteGlovePriceId,
    diagnosticMessage: "Former Weven offer (Phase 2) is ready.",
  };
}

export function isPricingWevenV1Ready(
  readiness: PricingWevenReadiness = getPricingWevenV1Readiness(),
): boolean {
  return readiness.ready;
}

export function isPricingWevenV1Misconfigured(
  readiness: PricingWevenReadiness = getPricingWevenV1Readiness(),
): boolean {
  return readiness.mode === "weven_misconfigured";
}

export function getPricingWevenOperationalSignal(): {
  mode: PricingWevenMode;
  ready: boolean;
  flagEnabled: boolean;
  missing: string[];
  message: string;
} {
  const readiness = getPricingWevenV1Readiness();
  return {
    mode: readiness.mode,
    ready: readiness.ready,
    flagEnabled: readiness.flagEnabled,
    missing: readiness.missing,
    message: readiness.diagnosticMessage,
  };
}
