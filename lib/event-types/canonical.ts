/**
 * Canonical HTC event-type vocabulary — single source of truth for public
 * inquiry, Schedule Tour, Leads, Events, labels, and accepted-type subsets.
 *
 * Legacy public aliases (corporate_event, birthday_milestone) normalize to
 * canonical values. social_event is first-class (never mapped to other).
 */

export type EventTypeOption = { value: string; label: string };

/** Full venue vocabulary (internal CRM + Social Event). */
export const EVENT_TYPES: EventTypeOption[] = [
  { value: "wedding", label: "Wedding" },
  { value: "elopement", label: "Elopement" },
  { value: "engagement_party", label: "Engagement Party" },
  { value: "rehearsal_dinner", label: "Rehearsal Dinner" },
  { value: "reception", label: "Reception Only" },
  { value: "corporate", label: "Corporate Event" },
  { value: "social_event", label: "Social Event" },
  { value: "birthday", label: "Birthday Party" },
  { value: "anniversary", label: "Anniversary Celebration" },
  { value: "shower", label: "Bridal / Baby Shower" },
  { value: "gala", label: "Gala / Fundraiser" },
  { value: "retreat", label: "Retreat" },
  { value: "celebration_of_life", label: "Celebration of Life" },
  { value: "quinceanera", label: "Quinceañera" },
  { value: "other", label: "Other" },
];

const CANONICAL_VALUES = new Set(EVENT_TYPES.map((t) => t.value));

/**
 * Default accepted types for new venues / public inquiry when unset.
 * Venues may add any other canonical type or remove down to one.
 */
export const DEFAULT_ACCEPTED_EVENT_TYPES: string[] = [
  "wedding",
  "corporate",
  "social_event",
  "birthday",
  "other",
];

/** Legacy stored values → canonical. Never maps meaningful types to other. */
export const EVENT_TYPE_LEGACY_ALIASES: Record<string, string> = {
  corporate_event: "corporate",
  birthday_milestone: "birthday",
};

export function isCanonicalEventType(value: string | null | undefined): boolean {
  if (!value) return false;
  return CANONICAL_VALUES.has(normalizeEventType(value) ?? "");
}

/** Normalize a stored or submitted value to a canonical key, or null if unknown. */
export function normalizeEventType(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const aliased = EVENT_TYPE_LEGACY_ALIASES[lower] ?? lower;
  if (CANONICAL_VALUES.has(aliased)) return aliased;
  const byLabel = EVENT_TYPES.find((t) => t.label.toLowerCase() === lower);
  return byLabel?.value ?? null;
}

export function eventTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const canonical = normalizeEventType(value);
  if (canonical) {
    return EVENT_TYPES.find((t) => t.value === canonical)?.label ?? canonical;
  }
  return value;
}

/**
 * Parse venue accepted list. Invalid entries dropped after alias normalize.
 * Empty/invalid → default public subset (never empty).
 */
export function parseAcceptedEventTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ACCEPTED_EVENT_TYPES];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const n = normalizeEventType(item);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.length > 0 ? out : [...DEFAULT_ACCEPTED_EVENT_TYPES];
}

export function filterValidAcceptedEventTypes(values: string[]): string[] {
  return parseAcceptedEventTypes(values);
}
