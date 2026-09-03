/**
 * Phase 2 planning-template recommendation — deterministic, explainable.
 *
 * Uses existing template fields only: kind, event_type, is_default, archived.
 * Does not score, rank, or invent package/guest-count/location matching.
 * Does not apply a template.
 */

import type { PlaybookKind, PlaybookTemplate } from "@/lib/playbooks/types";

export type RecommendableTemplate = Pick<
  PlaybookTemplate,
  "id" | "name" | "kind" | "eventType" | "isDefault" | "isArchived"
>;

export type PlanningRecommendReason =
  | "event_type_default"
  | "event_type_only_match"
  | "kind_default"
  | "multiple_matches"
  | "no_match";

export type PlanningTemplateRecommendation = {
  kind: PlaybookKind;
  recommended: RecommendableTemplate | null;
  matching: RecommendableTemplate[];
  choices: RecommendableTemplate[];
  reason: PlanningRecommendReason;
};

function byName(a: RecommendableTemplate, b: RecommendableTemplate): number {
  return a.name.localeCompare(b.name);
}

/**
 * Recommend a Client Planning or Venue Planning template for an event type.
 *
 * Matching = same kind + same event_type + not archived (exact event_type,
 * the same rule the former silent Booking.Confirmed apply used).
 *
 * Recommended, in order:
 * 1. The matching template marked is_default
 * 2. The only matching template (even if not default)
 * 3. If nothing matches the event type: the kind-wide default with no event type
 *    (same fallback as the Event Overview booking-setup picker)
 *
 * Multiple matching templates with no default are all shown as choices;
 * none is auto-selected.
 */
export function recommendPlanningTemplate(
  templates: RecommendableTemplate[],
  kind: PlaybookKind,
  eventType: string | null,
): PlanningTemplateRecommendation {
  const choices = templates
    .filter((t) => t.kind === kind && !t.isArchived)
    .slice()
    .sort(byName);

  const matching = eventType
    ? choices.filter((t) => t.eventType === eventType)
    : [];

  const eventTypeDefault = matching.find((t) => t.isDefault) ?? null;
  if (eventTypeDefault) {
    return {
      kind,
      recommended: eventTypeDefault,
      matching,
      choices,
      reason: "event_type_default",
    };
  }

  if (matching.length === 1) {
    return {
      kind,
      recommended: matching[0] ?? null,
      matching,
      choices,
      reason: "event_type_only_match",
    };
  }

  if (matching.length > 1) {
    return {
      kind,
      recommended: null,
      matching,
      choices,
      reason: "multiple_matches",
    };
  }

  const kindDefault = choices.find((t) => t.isDefault && !t.eventType) ?? null;
  if (kindDefault) {
    return {
      kind,
      recommended: kindDefault,
      matching,
      choices,
      reason: "kind_default",
    };
  }

  return {
    kind,
    recommended: null,
    matching,
    choices,
    reason: "no_match",
  };
}
