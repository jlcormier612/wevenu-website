/**
 * Setup Profile “Used for” — constrain assignments to the venue's accepted
 * event types (venues.accepted_inquiry_event_types). Venue-default (null)
 * is a separate applicability rule, not an event type.
 */
import {
  parseAcceptedEventTypes,
  normalizeEventType,
} from "@/lib/event-types/canonical";
import { buildVenueEventTypeOptions } from "@/lib/event-types/venue-options";

export const SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE =
  "That event type is not currently accepted by this venue.";

export type SetupProfileUsedForOption = {
  value: string;
  /** Checkbox / list label — wedding displays as All Weddings. */
  label: string;
};

/**
 * Options for the Setup Profile “Used for” event-type checkboxes.
 * accepted ∩ catalog only — no legacy “current type” extras.
 */
export function buildSetupProfileUsedForOptions(
  acceptedRaw: unknown,
): SetupProfileUsedForOption[] {
  return buildVenueEventTypeOptions({ acceptedRaw }).map((opt) => ({
    value: opt.value,
    label: opt.value === "wedding" ? "All Weddings" : opt.label,
  }));
}

/**
 * Normalize and accept only types in the venue's current accepted set.
 * Fail closed when any requested type is outside the accepted set.
 */
export function validateSetupProfileEventTypes(
  eventTypes: readonly string[],
  acceptedRaw: unknown,
):
  | { ok: true; eventTypes: string[] }
  | { ok: false; message: string } {
  const accepted = new Set(parseAcceptedEventTypes(acceptedRaw));
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const raw of eventTypes) {
    const key = normalizeEventType(raw);
    if (!key) {
      return { ok: false, message: SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE };
    }
    if (!accepted.has(key)) {
      return { ok: false, message: SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE };
    }
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return { ok: true, eventTypes: normalized };
}

/** Event types present in previous accepted set but not in next. */
export function removedAcceptedEventTypes(
  previousAcceptedRaw: unknown,
  nextAcceptedRaw: unknown,
): string[] {
  const previous = parseAcceptedEventTypes(previousAcceptedRaw);
  const next = new Set(parseAcceptedEventTypes(nextAcceptedRaw));
  return previous.filter((type) => !next.has(type));
}
