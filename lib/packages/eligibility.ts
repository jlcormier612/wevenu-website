/**
 * Package eligibility for proposal offers.
 * Unsupported rules are not invented — only columns present on packages.
 */

export type PackageOfferRole = "primary" | "addon";

export type PackageEligibilityFields = {
  isActive: boolean;
  basePrice: number | null;
  offerRole?: PackageOfferRole | null;
  eligibleEventTypes?: string[] | null;
  minGuestCount?: number | null;
  maxGuestCount?: number | null;
  eligibleSpaceIds?: string[] | null;
};

export type EligibilityContext = {
  eventType?: string | null;
  guestCount?: number | null;
  spaceId?: string | null;
};

export type EligibilityResult = {
  eligible: boolean;
  reason?: string;
};

/** Active + priced is always required. Optional filters apply only when set on the package. */
export function evaluatePackageEligibility(
  pkg: PackageEligibilityFields,
  ctx: EligibilityContext = {},
): EligibilityResult {
  if (!pkg.isActive) return { eligible: false, reason: "inactive" };
  if (pkg.basePrice == null || !(pkg.basePrice > 0)) {
    return { eligible: false, reason: "unpriced" };
  }

  const types = pkg.eligibleEventTypes;
  if (types && types.length > 0) {
    const et = (ctx.eventType ?? "").trim().toLowerCase();
    if (!et || !types.some((t) => t.trim().toLowerCase() === et)) {
      return { eligible: false, reason: "event_type" };
    }
  }

  const guests = ctx.guestCount;
  if (pkg.minGuestCount != null && guests != null && guests < pkg.minGuestCount) {
    return { eligible: false, reason: "min_guests" };
  }
  if (pkg.maxGuestCount != null && guests != null && guests > pkg.maxGuestCount) {
    return { eligible: false, reason: "max_guests" };
  }
  // When guest count unknown, min/max do not block (venue can still offer).

  const spaces = pkg.eligibleSpaceIds;
  if (spaces && spaces.length > 0) {
    const sid = ctx.spaceId ?? null;
    if (!sid || !spaces.includes(sid)) {
      return { eligible: false, reason: "space" };
    }
  }

  return { eligible: true };
}

export function filterEligiblePackages<T extends PackageEligibilityFields>(
  packages: T[],
  ctx: EligibilityContext = {},
): T[] {
  return packages.filter((p) => evaluatePackageEligibility(p, ctx).eligible);
}
