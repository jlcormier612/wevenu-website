/**
 * Venue-aware event-type options for inquiry/booking intake selectors.
 * Accepted set comes from venues.accepted_inquiry_event_types (via parseAcceptedEventTypes).
 * Legacy current values stay selectable when editing existing records.
 */

import {
  EVENT_TYPES,
  eventTypeLabel,
  normalizeEventType,
  parseAcceptedEventTypes,
  type EventTypeOption,
} from "@/lib/event-types/canonical";

export type VenueEventTypeOption = EventTypeOption & {
  /** Stored on this record but no longer in the venue's accepted inquiry set. */
  isLegacyCurrent?: boolean;
  /** Short helper under the option when isLegacyCurrent. */
  description?: string;
};

export const LEGACY_EVENT_TYPE_OPTION_SUFFIX = " — Current type";
export const LEGACY_EVENT_TYPE_OPTION_DESCRIPTION =
  "This type is no longer offered for new inquiries.";

/**
 * Options for a venue event-type selector.
 *
 * New records (no currentValue): accepted ∩ global catalog, catalog order.
 * Edit (currentValue outside accepted): accepted options + current marked legacy.
 */
export function buildVenueEventTypeOptions(args: {
  acceptedRaw: unknown;
  currentValue?: string | null;
}): VenueEventTypeOption[] {
  const accepted = parseAcceptedEventTypes(args.acceptedRaw);
  const acceptedSet = new Set(accepted);

  const options: VenueEventTypeOption[] = EVENT_TYPES.filter((t) =>
    acceptedSet.has(t.value),
  ).map((t) => ({ value: t.value, label: t.label }));

  const rawCurrent = args.currentValue?.trim() || "";
  if (!rawCurrent) return options;

  const canonical = normalizeEventType(rawCurrent);
  const currentKey = canonical ?? rawCurrent;
  if (acceptedSet.has(currentKey)) return options;
  if (options.some((o) => o.value === currentKey)) return options;

  const baseLabel = eventTypeLabel(rawCurrent) || rawCurrent;
  options.push({
    value: currentKey,
    label: `${baseLabel}${LEGACY_EVENT_TYPE_OPTION_SUFFIX}`,
    isLegacyCurrent: true,
    description: LEGACY_EVENT_TYPE_OPTION_DESCRIPTION,
  });

  return options;
}
