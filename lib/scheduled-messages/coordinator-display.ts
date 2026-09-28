/**
 * Customer-facing coordinator line for message-template merge
 * ({{coordinator_name}} in Warmly / See you soon signatures).
 *
 * Source of truth: venue_staff owner full_name + optional job title.
 * Never invent a name from venues.name — that duplicates the venue line.
 */

export type OwnerStaffIdentity = {
  full_name: string;
  title: string | null;
};

/** Format owner display for email signatures: "Jen Fancy, Owner". */
export function formatCoordinatorDisplayName(
  fullName: string | null | undefined,
  title?: string | null,
): string {
  const name = fullName?.trim() ?? "";
  if (!name) return "";
  const job = title?.trim();
  return job ? `${name}, ${job}` : name;
}

/**
 * Prefer an accepted, linked owner when multiple is_owner rows exist
 * (e.g. a pending owner invite alongside the real owner).
 * Mirrors getVenueFullDetails ordering: accepted_at ascending, nulls last.
 */
export function pickOwnerStaffForCoordinator(
  rows: Array<OwnerStaffIdentity & {
    accepted_at?: string | null;
    owner_invite_pending?: boolean | null;
    user_id?: string | null;
  }>,
): OwnerStaffIdentity | null {
  if (rows.length === 0) return null;
  const ranked = [...rows].sort((a, b) => {
    const aPending = a.owner_invite_pending ? 1 : 0;
    const bPending = b.owner_invite_pending ? 1 : 0;
    if (aPending !== bPending) return aPending - bPending;
    const aLinked = a.user_id ? 0 : 1;
    const bLinked = b.user_id ? 0 : 1;
    if (aLinked !== bLinked) return aLinked - bLinked;
    const aAt = a.accepted_at ? Date.parse(a.accepted_at) : Number.POSITIVE_INFINITY;
    const bAt = b.accepted_at ? Date.parse(b.accepted_at) : Number.POSITIVE_INFINITY;
    return aAt - bAt;
  });
  const pick = ranked[0];
  return pick ? { full_name: pick.full_name, title: pick.title } : null;
}
