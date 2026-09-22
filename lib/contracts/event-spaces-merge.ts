/**
 * Resolve the {{event_spaces}} merge label from canonical venue_spaces rows.
 *
 * Priority:
 * 1. Booked Event.space_id (occupying assignment)
 * 2. Lead.planned_event_space_id (pre-booking planning on the linked lead)
 * 3. Empty-state copy when neither is set
 *
 * Does not invent a second space catalog — both IDs point at venue_spaces.
 */

export const EMPTY_EVENT_SPACES_LABEL =
  "No event spaces are listed on this booking yet.";

export type EventSpaceNameRow = { id: string; name: string };

export function resolveEventSpacesLabel(opts: {
  spaces: EventSpaceNameRow[];
  eventSpaceId?: string | null;
  plannedEventSpaceId?: string | null;
}): string {
  if (opts.eventSpaceId) {
    const space = opts.spaces.find((s) => s.id === opts.eventSpaceId);
    if (space?.name?.trim()) return space.name.trim();
  }
  if (opts.plannedEventSpaceId) {
    const space = opts.spaces.find((s) => s.id === opts.plannedEventSpaceId);
    if (space?.name?.trim()) return space.name.trim();
  }
  return EMPTY_EVENT_SPACES_LABEL;
}

/**
 * Preview can bake the empty-state copy into the form body before create
 * resolves the client's Event. When we later know the real space label,
 * replace that empty copy so the contract document matches the booking.
 */
export function replaceEmptyEventSpacesLabel(
  content: string,
  eventSpacesLabel: string,
): string {
  if (!eventSpacesLabel || eventSpacesLabel === EMPTY_EVENT_SPACES_LABEL) {
    return content;
  }
  if (!content.includes(EMPTY_EVENT_SPACES_LABEL)) return content;
  return content.split(EMPTY_EVENT_SPACES_LABEL).join(eventSpacesLabel);
}
