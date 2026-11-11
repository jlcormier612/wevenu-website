/**
 * Timeline P2 / D5 — Overview destructive template replace guard.
 * Block when any venue-owned working timeline_entries exist for the event.
 */

export const VENUE_TIMELINE_REPLACE_BLOCKED_ERROR = "venue_owned_entries_exist";

/** Locked product copy for a blocked Overview template replace. */
export const VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE =
  "This event already has venue timeline items, including items added from the schedule. Replacing the template would remove that work.\n\n"
  + "To keep your existing items, add items from a template on the Timeline tab instead.\n\n"
  + "A safer replace option isn’t available yet.";

export function isVenueTimelineReplaceBlockedError(error: string | null | undefined): boolean {
  return error === VENUE_TIMELINE_REPLACE_BLOCKED_ERROR;
}
