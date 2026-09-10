/**
 * Pure Vendor list presentation helpers.
 * Preference (ranking) and claim state stay distinct; invitation is never inferred.
 */
import type { VendorPreferenceLevel, VendorRelationshipStatus } from "@/lib/vendors/types";

/** Claim-state labels for venue ops — not primary client-facing copy. */
export type VendorClaimStateLabel = "Claimed" | "Not claimed";

export function vendorClaimStateLabel(isClaimed: boolean): VendorClaimStateLabel {
  return isClaimed ? "Claimed" : "Not claimed";
}

/**
 * Client-facing approved directory / new pick eligibility.
 * invited + active are available; inactive must not appear or be newly selected.
 * Mirrors get_venue_vendor_directory / toggle_directory_vendor_pick predicates.
 */
export function venueRelationshipAvailableToClients(
  status: VendorRelationshipStatus | string,
): boolean {
  return status === "invited" || status === "active";
}

/**
 * Vendor home immersion / "active venue" — any non-inactive relationship.
 * Inactive must not become the active partnership hero.
 */
export function venueRelationshipEligibleForActiveVenue(
  status: VendorRelationshipStatus | string,
): boolean {
  return status !== "inactive";
}

/**
 * Preference badge shown in the Preference column.
 * Approved (standard) stays blank — baseline on the list.
 */
export function vendorPreferenceBadgeKind(
  preferenceLevel: VendorPreferenceLevel | string,
): "recommended" | "preferred" | null {
  if (preferenceLevel === "preferred" || preferenceLevel === "featured") return "preferred";
  if (preferenceLevel === "recommended") return "recommended";
  return null;
}

/** Same ranking used by the list "Preferred First" sort. */
export function vendorPreferenceSortRank(
  preferenceLevel: VendorPreferenceLevel | string,
): number {
  if (preferenceLevel === "preferred" || preferenceLevel === "featured") return 2;
  if (preferenceLevel === "recommended") return 1;
  return 0;
}

/** Client-facing preference chip copy. */
export function vendorPreferenceClientLabel(
  preferenceLevel: VendorPreferenceLevel | string,
): string | null {
  if (preferenceLevel === "preferred" || preferenceLevel === "featured") return "Preferred";
  if (preferenceLevel === "recommended") return "Recommended";
  return null;
}

/**
 * Models venues_manage_relationships after remediation:
 * venue_id = current_user_venue_id()
 */
export function venueStaffCanManageRelationship(
  relationshipVenueId: string,
  currentUserVenueId: string | null,
): boolean {
  return currentUserVenueId !== null && relationshipVenueId === currentUserVenueId;
}

/**
 * Models venues_see_vendor_team after remediation:
 * an active (non-inactive) relationship whose venue_id matches current_user_venue_id().
 */
export function venueStaffCanSeeVendorTeam(
  activeRelationshipVenueIds: readonly string[],
  currentUserVenueId: string | null,
): boolean {
  if (currentUserVenueId === null) return false;
  return activeRelationshipVenueIds.includes(currentUserVenueId);
}

/**
 * Models venues_select_related_vendors after remediation:
 * active (non-inactive) relationship whose venue_id matches current_user_venue_id(),
 * OR the caller's own vendor id (portal self-access).
 */
export function venueStaffCanSelectRelatedVendor(
  activeRelationshipVenueIds: readonly string[],
  currentUserVenueId: string | null,
  options?: { vendorId?: string; currentUserVendorId?: string | null },
): boolean {
  if (
    options?.vendorId != null &&
    options.currentUserVendorId != null &&
    options.vendorId === options.currentUserVendorId
  ) {
    return true;
  }
  if (currentUserVenueId === null) return false;
  return activeRelationshipVenueIds.includes(currentUserVenueId);
}

/**
 * Models venues_update_unclaimed_vendors after remediation:
 * is_claimed = false AND an active relationship matching current_user_venue_id().
 */
export function venueStaffCanUpdateUnclaimedVendor(
  isClaimed: boolean,
  activeRelationshipVenueIds: readonly string[],
  currentUserVenueId: string | null,
): boolean {
  if (isClaimed) return false;
  if (currentUserVenueId === null) return false;
  return activeRelationshipVenueIds.includes(currentUserVenueId);
}

/**
 * Models venues_insert_vendors after remediation:
 * current_user_venue_id() is not null.
 */
export function venueStaffCanInsertVendor(
  currentUserVenueId: string | null,
): boolean {
  return currentUserVenueId !== null;
}
