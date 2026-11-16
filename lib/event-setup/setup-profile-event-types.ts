/**
 * Setup Profile “Used for” options and assignment validation.
 *
 * Public inquiry accepted types and internally managed HTC event types are
 * independent. Hosted families (wedding, corporate, social_event) may be
 * assigned on a Setup Profile without advertising them on the public inquiry
 * form. Other catalog types remain gated by public inquiry acceptance.
 */
import {
  EVENT_TYPES,
  isCanonicalEventType,
  normalizeEventType,
  parseAcceptedEventTypes,
} from "@/lib/event-types/canonical";
import {
  HOSTED_EVENT_TYPE_VALUES,
  isHostedEventType,
} from "@/lib/setup-hub/phase-b1-event-types";

export const SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE =
  "That event type is not currently accepted by this venue.";

export type SetupProfileUsedForOption = {
  value: string;
  /** Checkbox / list label — wedding displays as All Weddings. */
  label: string;
};

export function suggestedSetupProfileName(eventType?: string | null): string {
  if (eventType === "corporate") return "Corporate Event Setup";
  if (eventType === "social_event") return "Social Celebration Setup";
  return "Standard Wedding Setup";
}

/**
 * Options for the Setup Profile “Used for” event-type checkboxes.
 * Public inquiry accepted types ∪ internally managed hosted families.
 */
export function buildSetupProfileUsedForOptions(
  acceptedRaw: unknown,
): SetupProfileUsedForOption[] {
  const accepted = new Set(parseAcceptedEventTypes(acceptedRaw));
  const allowed = new Set<string>([...accepted, ...HOSTED_EVENT_TYPE_VALUES]);
  return EVENT_TYPES.filter((opt) => allowed.has(opt.value)).map((opt) => ({
    value: opt.value,
    label: opt.value === "wedding" ? "All Weddings" : opt.label,
  }));
}

/**
 * Hosted families are valid for internal Setup Profile assignment even when
 * they are not accepted for public inquiries. Other types fail closed unless
 * they are in the venue's current accepted inquiry set.
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
    if (!key || !isCanonicalEventType(key)) {
      return { ok: false, message: SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE };
    }
    if (!accepted.has(key) && !isHostedEventType(key)) {
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

/**
 * Inquiry-accepted types that can be pruned from Setup Profile assignments.
 * Hosted families stay assigned when they are removed from public inquiries.
 */
export function assignmentTypesToPruneOnInquiryRemoval(
  removedEventTypes: readonly string[],
): string[] {
  return [...new Set(removedEventTypes.filter(Boolean))].filter((type) => !isHostedEventType(type));
}
