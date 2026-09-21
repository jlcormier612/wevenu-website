/**
 * Inbox Event Type filter options — venue Setup accepted types + optional legacy bucket.
 * Source of truth: venues.accepted_inquiry_event_types (parsed). Filtering only;
 * does not mutate stored lead/event types.
 */

import {
  EVENT_TYPES,
  eventTypeLabel,
  normalizeEventType,
  parseAcceptedEventTypes,
  type EventTypeOption,
} from "@/lib/event-types/canonical";

/** Filter sentinel — expands server-side to stored types outside current accepted set. */
export const INBOX_EVENT_TYPE_LEGACY = "__legacy__";

export const INBOX_EVENT_TYPE_LEGACY_LABEL =
  "Other / Legacy Types (event types no longer supported)";

/** Matches no stored type — used when legacy is selected but none exist. */
export const INBOX_EVENT_TYPE_NO_MATCH = "__inbox_no_match__";

export function inboxEventTypeOptionLabel(value: string): string {
  if (value === INBOX_EVENT_TYPE_LEGACY) return INBOX_EVENT_TYPE_LEGACY_LABEL;
  return eventTypeLabel(value) || value;
}

/**
 * Whether the legacy bucket belongs in the filter UI.
 * Only when the venue does not currently accept every canonical type —
 * otherwise the bucket would always be empty/noise.
 */
export function shouldShowInboxLegacyEventTypeBucket(acceptedRaw: unknown): boolean {
  const accepted = new Set(parseAcceptedEventTypes(acceptedRaw));
  return EVENT_TYPES.some((t) => !accepted.has(t.value));
}

/**
 * Visible Event Type checkboxes for Inbox, in canonical order.
 * Current accepted types each get their own option; optionally the legacy bucket.
 */
export function buildInboxEventTypeFilterOptions(acceptedRaw: unknown): EventTypeOption[] {
  const accepted = parseAcceptedEventTypes(acceptedRaw);
  const acceptedSet = new Set(accepted);
  const options: EventTypeOption[] = EVENT_TYPES
    .filter((t) => acceptedSet.has(t.value))
    .map((t) => ({ value: t.value, label: t.label }));

  if (shouldShowInboxLegacyEventTypeBucket(accepted)) {
    options.push({
      value: INBOX_EVENT_TYPE_LEGACY,
      label: INBOX_EVENT_TYPE_LEGACY_LABEL,
    });
  }
  return options;
}

/** True when a stored event_type string is outside the venue's current accepted set. */
export function isStoredEventTypeOutsideAccepted(
  stored: string | null | undefined,
  acceptedCanonical: readonly string[],
): boolean {
  if (stored == null) return false;
  const trimmed = stored.trim();
  if (!trimmed) return false;
  const accepted = new Set(acceptedCanonical);
  const canonical = normalizeEventType(trimmed);
  if (canonical && accepted.has(canonical)) return false;
  if (accepted.has(trimmed)) return false;
  return true;
}

/**
 * Expand UI filter selections into RPC p_event_types values.
 * Legacy sentinel → concrete stored values outside accepted (or NO_MATCH if none).
 */
export function expandInboxEventTypeFilterValues(
  selected: readonly string[],
  acceptedCanonical: readonly string[],
  legacyStoredValues: readonly string[],
): string[] | null {
  if (selected.length === 0) return null;

  const wantsLegacy = selected.includes(INBOX_EVENT_TYPE_LEGACY);
  const concrete = selected.filter((t) => t !== INBOX_EVENT_TYPE_LEGACY);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const t of concrete) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }

  if (wantsLegacy) {
    const legacy = legacyStoredValues.filter((v) =>
      isStoredEventTypeOutsideAccepted(v, acceptedCanonical),
    );
    if (legacy.length === 0 && concrete.length === 0) {
      return [INBOX_EVENT_TYPE_NO_MATCH];
    }
    for (const v of legacy) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }

  return out.length > 0 ? out : null;
}
