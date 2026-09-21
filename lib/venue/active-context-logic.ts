/**
 * Pure Wave 2 case classification (testable without DB).
 */

export type MembershipRef = { venueId: string };

export type ActiveVenueCase =
  | "A_auto_single"
  | "B_keep_valid"
  | "C_need_selection"
  | "D_none"
  | "E_stale_need_selection";

/**
 * Given memberships and optional DB context venue (already membership-verified
 * or not), decide bootstrap behavior. Cookie is ignored for authorization.
 */
export function classifyActiveVenueCase(input: {
  memberships: MembershipRef[];
  /** Active context venue id from DB, or null if missing. */
  dbContextVenueId: string | null;
  /** Whether dbContextVenueId still has active+accepted membership. */
  dbContextMembershipValid: boolean;
}): ActiveVenueCase {
  const { memberships, dbContextVenueId, dbContextMembershipValid } = input;
  if (memberships.length === 0) return "D_none";

  if (dbContextVenueId && dbContextMembershipValid) {
    const stillMember = memberships.some((m) => m.venueId === dbContextVenueId);
    if (stillMember) return "B_keep_valid";
    return "E_stale_need_selection";
  }

  if (dbContextVenueId && !dbContextMembershipValid) {
    return "E_stale_need_selection";
  }

  if (memberships.length === 1) return "A_auto_single";
  return "C_need_selection";
}

/** Cookie must never win over DB. */
export function resolveCookieAfterDbSync(input: {
  dbVenueId: string | null;
  cookieVenueId: string | null;
}): { cookieVenueId: string | null; action: "clear" | "write" | "keep" } {
  if (!input.dbVenueId) {
    return { cookieVenueId: null, action: input.cookieVenueId ? "clear" : "keep" };
  }
  if (input.cookieVenueId !== input.dbVenueId) {
    return { cookieVenueId: input.dbVenueId, action: "write" };
  }
  return { cookieVenueId: input.dbVenueId, action: "keep" };
}
