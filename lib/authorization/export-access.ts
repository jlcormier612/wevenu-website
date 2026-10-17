import type { MembershipAccessInput } from "@/lib/authorization/types";

/**
 * Venue data export access.
 *
 * Owner and Administrator are authorized even when `data.export` is absent
 * or explicitly turned off. Every other active member is authorized only
 * when `capability_overrides.data.export` is true. Presets are unchanged:
 * Administrator already includes the capability; Manager and below do not.
 */
export function canExportVenueData(membership: MembershipAccessInput): boolean {
  if (!membership.isActive) return false;
  if (membership.isOwner) return true;
  const basis = membership.accessTitle === "custom"
    ? membership.titleBasis
    : membership.accessTitle;
  if (basis === "administrator") return true;
  return membership.overrides?.["data.export"] === true;
}
