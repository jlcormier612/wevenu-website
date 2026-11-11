/**
 * Floor Plan Templates — venue-scoped event-type select options.
 *
 * Reuses buildVenueEventTypeOptions (accepted_inquiry_event_types ∩ catalog).
 * Filter sentinel "All event types" = do not filter templates by event type.
 * Create sentinel "Any event type" = persist null event_type (unchanged).
 */

import {
  buildVenueEventTypeOptions,
  type VenueEventTypeOption,
} from "@/lib/event-types/venue-options";

/** Existing filter/create sentinel — same value as before this scoping fix. */
export const FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE = "__any__";

export type FloorPlanTemplateEventTypeOption = {
  value: string;
  label: string;
  isLegacyCurrent?: boolean;
  description?: string;
};

export function buildFloorPlanTemplateFilterEventTypeOptions(
  acceptedRaw: unknown,
): FloorPlanTemplateEventTypeOption[] {
  return [
    { value: FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE, label: "All event types" },
    ...buildVenueEventTypeOptions({ acceptedRaw }),
  ];
}

export function buildFloorPlanTemplateCreateEventTypeOptions(
  acceptedRaw: unknown,
): FloorPlanTemplateEventTypeOption[] {
  return [
    { value: FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE, label: "Any event type" },
    ...buildVenueEventTypeOptions({ acceptedRaw }),
  ];
}

/**
 * Edit / legacy: keep the template's current event_type selectable even when
 * it is no longer in the venue's accepted configuration (Leads convention).
 */
export function buildFloorPlanTemplateEditEventTypeOptions(
  acceptedRaw: unknown,
  currentValue: string | null | undefined,
): FloorPlanTemplateEventTypeOption[] {
  const venueOpts: VenueEventTypeOption[] = buildVenueEventTypeOptions({
    acceptedRaw,
    currentValue,
  });
  return [
    { value: FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE, label: "Any event type" },
    ...venueOpts,
  ];
}
