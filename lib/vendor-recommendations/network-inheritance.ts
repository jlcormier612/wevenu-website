/**
 * Pure rules for seeding event-level client-facing recommendations from the
 * venue Vendor Network. Required (is_required) is venue policy for booking
 * assignments — it does not by itself make a vendor a client recommendation.
 * Preference levels preferred / recommended / standard (Approved) are the
 * client-facing standard list.
 */

import { venueRelationshipAvailableToClients } from "@/lib/vendors/list-presentation";

const CLIENT_FACING_PREFERENCE = new Set([
  "preferred",
  "featured",
  "recommended",
  "standard",
]);

export type NetworkVendorSeedInput = {
  vendorId: string;
  status: string;
  preferenceLevel: string;
  isRequired?: boolean;
};

/** Eligible for automatic event recommendation inheritance from Network. */
export function isNetworkVendorEligibleForEventRecommendation(
  input: NetworkVendorSeedInput,
): boolean {
  if (!venueRelationshipAvailableToClients(input.status)) return false;
  const level = (input.preferenceLevel || "standard").toLowerCase();
  return CLIENT_FACING_PREFERENCE.has(level);
}

/**
 * Seed-once: when the event already has any venue recommendation rows, do not
 * re-insert Network vendors (preserves event-specific exclusions). When empty,
 * return every eligible Network vendor id to insert.
 */
export function networkVendorIdsToSeed(
  network: NetworkVendorSeedInput[],
  existingRecommendationVendorIds: readonly string[],
): string[] {
  if (existingRecommendationVendorIds.length > 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of network) {
    if (!isNetworkVendorEligibleForEventRecommendation(row)) continue;
    if (seen.has(row.vendorId)) continue;
    seen.add(row.vendorId);
    out.push(row.vendorId);
  }
  return out;
}
