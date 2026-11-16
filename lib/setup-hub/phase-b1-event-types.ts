/**
 * Phase B1 hosted event-type families for Milestone 02.
 * Uses existing canonical identifiers. Independent of public inquiry types.
 */
import { isCanonicalEventType, normalizeEventType } from "@/lib/event-types/canonical";

export const HOSTED_EVENT_TYPE_OPTIONS = [
  {
    value: "wedding",
    label: "Weddings",
    starterHint: "Review your wedding Setup Profile and the resources HTC has prepared.",
    needsSetupHint: "Start with HTC's wedding planning resources and prepare your reusable event experience.",
  },
  {
    value: "corporate",
    label: "Corporate events",
    starterHint: "Review your corporate Setup Profile and the resources HTC has prepared.",
    needsSetupHint:
      "Start with HTC's corporate planning resources and prepare your reusable event experience.",
  },
  {
    value: "social_event",
    label: "Social celebrations",
    checkboxLabel: "Social celebrations (birthdays, showers, quinceañeras & more)",
    starterHint: "Review your social Setup Profile and the resources HTC has prepared.",
    needsSetupHint:
      "Start with HTC's social planning resources and prepare your reusable event experience.",
  },
] as const;

export type HostedEventTypeValue = (typeof HOSTED_EVENT_TYPE_OPTIONS)[number]["value"];

export const HOSTED_EVENT_TYPE_VALUES: readonly HostedEventTypeValue[] =
  HOSTED_EVENT_TYPE_OPTIONS.map((option) => option.value);

const HOSTED_SET = new Set<string>(HOSTED_EVENT_TYPE_VALUES);

export function isHostedEventType(value: string | null | undefined): value is HostedEventTypeValue {
  if (!value) return false;
  const key = normalizeEventType(value);
  return Boolean(key && HOSTED_SET.has(key) && isCanonicalEventType(key));
}

export function hostedEventTypeLabel(value: string): string {
  const key = normalizeEventType(value);
  return HOSTED_EVENT_TYPE_OPTIONS.find((option) => option.value === key)?.label ?? value;
}

export function hostedEventTypeOption(value: string) {
  const key = normalizeEventType(value);
  return HOSTED_EVENT_TYPE_OPTIONS.find((option) => option.value === key) ?? null;
}

/**
 * Persist only canonical hosted-family keys, in display order, unique.
 * Unknown values are dropped rather than stored.
 */
export function normalizeHostedEventTypes(raw: unknown): HostedEventTypeValue[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<HostedEventTypeValue>();
  const out: HostedEventTypeValue[] = [];
  for (const option of HOSTED_EVENT_TYPE_OPTIONS) {
    const matched = list.some((item) => {
      const key = typeof item === "string" ? normalizeEventType(item) : null;
      return key === option.value;
    });
    if (matched && !seen.has(option.value)) {
      seen.add(option.value);
      out.push(option.value);
    }
  }
  return out;
}

/**
 * Display and readiness default for a venue that has not yet saved a selection.
 * Persistence stays null until the owner saves. Corporate and social are not
 * implied.
 */
export function effectiveHostedEventTypes(
  raw: string[] | null | undefined,
): HostedEventTypeValue[] {
  if (raw == null) return ["wedding"];
  return normalizeHostedEventTypes(raw);
}
