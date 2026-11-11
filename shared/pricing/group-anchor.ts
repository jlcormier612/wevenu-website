/**
 * Additional-venue (group) discount: first/anchor venue never receives the
 * org 10% merely because a second property joins. Only subsequent venues do.
 *
 * Anchor selection (deterministic):
 * 1. Exactly one membership with role `primary` among candidates → that venue
 * 2. Else earliest `createdAt`, tie-break by venueId
 */

export type GroupAnchorMember = {
  venueId: string;
  role: "member" | "primary";
  createdAt: string;
  /** True when this venue currently counts toward org qualifying set. */
  qualifies: boolean;
};

/**
 * Anchor (first) venue among qualifying members, or null when none qualify.
 */
export function resolveOrgAnchorVenueId(
  members: GroupAnchorMember[],
): string | null {
  const qualifying = members.filter((m) => m.qualifies && m.venueId.trim());
  if (qualifying.length === 0) return null;

  const primaries = qualifying.filter((m) => m.role === "primary");
  if (primaries.length === 1) return primaries[0]!.venueId;

  const sorted = [...qualifying].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    if (byTime !== 0) return byTime;
    return a.venueId.localeCompare(b.venueId);
  });
  return sorted[0]!.venueId;
}

/**
 * Whether this venue may receive the additional-venue 10% (group_pct).
 * Requires multiple qualifying venues and that this venue is not the anchor.
 */
export function venueReceivesAdditionalVenueDiscount(input: {
  venueId: string;
  anchorVenueId: string | null;
  qualifyingVenueCount: number;
}): boolean {
  if (input.qualifyingVenueCount < 2) return false;
  if (!input.anchorVenueId) return false;
  return input.venueId !== input.anchorVenueId;
}
