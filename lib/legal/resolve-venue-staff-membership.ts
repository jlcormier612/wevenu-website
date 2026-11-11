/**
 * Venue-scoped staff membership selection for legal principal resolution.
 * Pure — no DB / framework imports.
 *
 * Avoids unscoped maybeSingle() multi-row failures (PGRST116) that previously
 * dropped venue membership and fell through to vendor on venue paths.
 */

export type VenueStaffMembershipRow = {
  venue_id: string;
  role: string | null;
  is_owner: boolean | null;
  is_active?: boolean | null;
};

export type VenueStaffMembershipResolution =
  | {
      status: "resolved";
      row: VenueStaffMembershipRow;
    }
  /** No active venue_staff rows for this user. */
  | { status: "none" }
  /**
   * Multiple active memberships and no usable venue context, or venue context
   * does not match any membership while other memberships exist.
   * Callers must fail closed on venue paths (never treat as vendor).
   */
  | { status: "ambiguous" }
  /** Query / transport error — not proof of zero membership. */
  | { status: "error"; message: string };

function isActiveRow(row: VenueStaffMembershipRow): boolean {
  return row.is_active !== false;
}

/**
 * Select the staff membership that should drive legal user-type mapping.
 *
 * @param activeVenueId When set, prefers the membership for that venue.
 */
export function selectVenueStaffMembership(input: {
  rows: VenueStaffMembershipRow[] | null | undefined;
  error?: { message?: string; code?: string } | null;
  activeVenueId?: string | null;
}): VenueStaffMembershipResolution {
  if (input.error) {
    return {
      status: "error",
      message: input.error.message?.trim() || input.error.code || "query_error",
    };
  }

  const rows = (input.rows ?? []).filter(isActiveRow);
  if (rows.length === 0) {
    return { status: "none" };
  }

  const venueId = input.activeVenueId?.trim() || null;
  if (venueId) {
    const match = rows.find((row) => row.venue_id === venueId);
    if (match) {
      return { status: "resolved", row: match };
    }
    // Cookie/context points at a venue this user is not staff of, but they
    // have other memberships — do not invent a row or fall through to vendor.
    return { status: "ambiguous" };
  }

  if (rows.length === 1) {
    return { status: "resolved", row: rows[0]! };
  }

  return { status: "ambiguous" };
}

/**
 * Whether venue-path principal resolution may continue to vendor fallback.
 * Only when we positively know there is no venue staff membership.
 */
export function mayFallThroughToVendorOnVenuePath(
  resolution: VenueStaffMembershipResolution,
): boolean {
  return resolution.status === "none";
}
