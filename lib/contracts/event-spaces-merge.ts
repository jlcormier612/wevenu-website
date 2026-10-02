/**
 * Resolve the {{event_spaces}} merge label from canonical venue spaces.
 *
 * Priority:
 * 1. event_space_assignments for the booked event (use → physical space)
 * 2. Event.space_id (legacy single assignment)
 * 3. Lead.planned_event_space_id (pre-booking planning)
 * 4. Empty-state copy when none is set
 *
 * Does not invent a second space catalog — all IDs point at venue_spaces.
 *
 * {{additional_event_spaces}} is a residual view of the same assignments table
 * (excludes ceremony, reception, and legacy event_space). Empty → "".
 */

import { formatEventSpaceAssignmentsDisplay } from "@/lib/venue-spaces/uses";

export const EMPTY_EVENT_SPACES_LABEL =
  "No event spaces are listed on this booking yet.";

/** use_keys never listed under {{additional_event_spaces}}. */
export const ADDITIONAL_EVENT_SPACES_EXCLUDED_USE_KEYS = new Set([
  "ceremony",
  "reception",
  "event_space",
]);

export type EventSpaceNameRow = { id: string; name: string };

export type EventSpaceAssignmentRow = {
  useKey: string;
  useLabel: string;
  spaceId: string;
  spaceName?: string | null;
};

export function resolveEventSpacesLabel(opts: {
  spaces: EventSpaceNameRow[];
  eventSpaceId?: string | null;
  plannedEventSpaceId?: string | null;
  assignments?: EventSpaceAssignmentRow[] | null;
}): string {
  if (opts.assignments && opts.assignments.length > 0) {
    const withNames = opts.assignments.map((a) => ({
      useKey: a.useKey,
      useLabel: a.useLabel,
      spaceName:
        a.spaceName?.trim() ||
        opts.spaces.find((s) => s.id === a.spaceId)?.name?.trim() ||
        "",
    })).filter((a) => a.spaceName);
    const formatted = formatEventSpaceAssignmentsDisplay(withNames);
    if (formatted) return formatted;
  }
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
 * Residual assigned spaces for {{additional_event_spaces}}.
 * Empty string when none — never missing-value copy (starter omits the section).
 */
export function resolveAdditionalEventSpacesLabel(opts: {
  spaces: EventSpaceNameRow[];
  assignments?: EventSpaceAssignmentRow[] | null;
}): string {
  const rows = (opts.assignments ?? [])
    .filter((a) => !ADDITIONAL_EVENT_SPACES_EXCLUDED_USE_KEYS.has(a.useKey.trim()))
    .map((a) => {
      const spaceName =
        a.spaceName?.trim() ||
        opts.spaces.find((s) => s.id === a.spaceId)?.name?.trim() ||
        "";
      return spaceName;
    })
    .filter(Boolean);
  // Preserve assignment order; one line per residual assignment (space name).
  return rows.join("\n");
}

/**
 * After merge: drop the starter "Additional Event Spaces" heading when the
 * resolved value was empty (no residual assignments).
 */
export function omitEmptyAdditionalEventSpacesSection(content: string): string {
  // Heading immediately followed by blank line / next section rule / EOF.
  return content
    .replace(/(^|\n)Additional Event Spaces\n(?=\n|─|$)/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
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
