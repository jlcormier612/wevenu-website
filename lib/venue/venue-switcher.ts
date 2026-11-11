/**
 * Persistent shell switcher is offered only when the signed-in user has
 * more than one accepted venue_staff membership. A single membership keeps
 * the static venue name. This does not authorize anything — set_active_venue
 * still checks venue_staff.
 */
export function offersPersistentVenueSwitch(
  memberships: readonly { venueId: string }[],
): boolean {
  const ids = new Set(
    memberships.map((membership) => membership.venueId).filter(Boolean),
  );
  return ids.size > 1;
}
