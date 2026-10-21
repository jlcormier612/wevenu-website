/**
 * Venue planning / setup capabilities — which Hello to Cheers experiences
 * this venue includes in its standard post-booking workflow.
 *
 * Venue-wide flags are the inclusion source of truth for Setup Profiles and
 * booking auto-apply. A Planning Template / Setup Profile configures starting
 * content only for capabilities that are on.
 */

import type { TaskActionType } from "@/lib/playbooks/types";

export type PlanningCapabilityId =
  | "checklists"
  | "timeline"
  | "floor_plan"
  | "seating"
  | "vendors"
  | "inventory"
  | "event_order"
  | "questionnaires";

export type VenuePlanningCapabilities = {
  /** Client + venue Planning checklists / task lists. */
  checklists: boolean;
  timeline: boolean;
  floorPlan: boolean;
  /**
   * Guest seating charts (distinct from floor-plan layout options).
   * Lives on a chosen floor plan; separate portal/readiness surface.
   */
  seating: boolean;
  vendors: boolean;
  inventory: boolean;
  eventOrder: boolean;
  questionnaires: boolean;
};

export const DEFAULT_PLANNING_CAPABILITIES: VenuePlanningCapabilities = {
  checklists: true,
  timeline: true,
  floorPlan: true,
  seating: true,
  vendors: true,
  inventory: true,
  eventOrder: true,
  questionnaires: true,
};

/**
 * Venue-facing explanations. Copy must match real consumers.
 * Floor plans (layout options) and seating (guest seating charts) stay separate.
 */
export const PLANNING_CAPABILITY_OPTIONS: {
  id: PlanningCapabilityId;
  key: keyof VenuePlanningCapabilities;
  label: string;
  description: string;
}[] = [
  {
    id: "checklists",
    key: "checklists",
    label: "Planning checklists",
    description:
      "Client Planning checklist (client task list) and Venue Planning checklist (internal venue task list). When on, Setup Profiles choose starting checklists for each event type and booking applies them. The venue checklist stays internal and is never released to the couple’s portal. When off, checklists are not part of the standard setup and do not create configuration gaps.",
  },
  {
    id: "timeline",
    key: "timeline",
    label: "Timeline",
    description:
      "Shared day-of event timeline for couples and your team. When on, Setup Profiles can choose a starting timeline template. When off, Timeline is omitted from Setup Profiles, Event Setup, Event Readiness, and the couple’s portal, and Planning Templates will not create timeline work.",
  },
  {
    id: "floor_plan",
    key: "floorPlan",
    label: "Floor plans",
    description:
      "Room layout options clients can choose from (for example Ceremony + Reception, Reception Only, Rain Plan). When on, Setup Profiles select which layouts to offer and a preferred starting plan. When off, Floor Plans are omitted from Setup Profiles, Event Setup, and the couple’s portal.",
  },
  {
    id: "seating",
    key: "seating",
    label: "Seating arrangements",
    description:
      "Guest seating charts on a chosen floor plan—who sits where. This is separate from Floor plans (which offer layout options). When off, Seating does not appear in Event Readiness or the couple’s portal, and Planning Templates will not create seating work.",
  },
  {
    id: "vendors",
    key: "vendors",
    label: "Vendor Network",
    description:
      "Let couples discover your Vendor Network (preferred, recommended, and required classifications). Your team manages classifications in Vendor Network—not a second list in Setup Profiles. When off, Preferred Vendors is hidden from the couple’s portal (existing vendor records stay on file).",
  },
  {
    id: "inventory",
    key: "inventory",
    label: "Inventory",
    description:
      "Event inventory offerings and drafts. When on, Setup Profiles choose a starting offering and booking prepares the event inventory draft (not shared, not an invoice). When off, Inventory is omitted from Setup Profiles and is not auto-created at booking.",
  },
  {
    id: "event_order",
    key: "eventOrder",
    label: "Event Order",
    description:
      "Event Order packages and drafts. When on, Setup Profiles choose a starting package and booking prepares the Event Order draft (not an invoice or payment plan). When off, Event Order is omitted from Setup Profiles and is not auto-created at booking.",
  },
  {
    id: "questionnaires",
    key: "questionnaires",
    label: "Questionnaires",
    description:
      "Optional questionnaires for your standard process. When on, Setup Profiles may select questionnaire templates prepared as drafts at booking. Delivery and sending stay in the questionnaire/communication workflow—never sent by portal release or invitation. When off, questionnaires do not create Setup Profile gaps or block release.",
  },
];

const TRIGGER_TO_CAPABILITY: Record<string, PlanningCapabilityId> = {
  timeline_created: "timeline",
  timeline_submitted: "timeline",
  floor_plan_created: "floor_plan",
  seating_submitted: "seating",
  vendor_selected: "vendors",
};

const ACTION_TO_CAPABILITY: Partial<Record<TaskActionType, PlanningCapabilityId>> = {
  timeline: "timeline",
  floor_plan: "floor_plan",
  vendor_library: "vendors",
};

export function capabilityRequiredByTask(task: {
  autoCompleteTrigger?: string | null;
  actionType?: string | null;
}): PlanningCapabilityId | null {
  if (task.autoCompleteTrigger && TRIGGER_TO_CAPABILITY[task.autoCompleteTrigger]) {
    return TRIGGER_TO_CAPABILITY[task.autoCompleteTrigger]!;
  }
  if (task.actionType && ACTION_TO_CAPABILITY[task.actionType as TaskActionType]) {
    return ACTION_TO_CAPABILITY[task.actionType as TaskActionType]!;
  }
  return null;
}

export function isCapabilityEnabled(
  caps: VenuePlanningCapabilities,
  id: PlanningCapabilityId,
): boolean {
  switch (id) {
    case "checklists":
      return caps.checklists;
    case "timeline":
      return caps.timeline;
    case "floor_plan":
      return caps.floorPlan;
    case "seating":
      return caps.seating;
    case "vendors":
      return caps.vendors;
    case "inventory":
      return caps.inventory;
    case "event_order":
      return caps.eventOrder;
    case "questionnaires":
      return caps.questionnaires;
  }
}

/** Tasks that require a disabled venue capability are omitted at apply time. */
export function filterTasksForVenueCapabilities<T extends {
  autoCompleteTrigger?: string | null;
  actionType?: string | null;
}>(
  tasks: T[],
  caps: VenuePlanningCapabilities,
): T[] {
  return tasks.filter((t) => {
    const needed = capabilityRequiredByTask(t);
    if (!needed) return true;
    return isCapabilityEnabled(caps, needed);
  });
}

/**
 * Incomplete couple-facing work tied to a disabled capability should not
 * appear as missing/incomplete. Completed rows may still show.
 */
export function shouldHideIncompleteTaskForCapabilities(
  task: {
    autoCompleteTrigger?: string | null;
    actionType?: string | null;
    status?: string;
  },
  caps: VenuePlanningCapabilities,
): boolean {
  if (task.status === "complete" || task.status === "waived") return false;
  const needed = capabilityRequiredByTask(task);
  if (!needed) return false;
  return !isCapabilityEnabled(caps, needed);
}

/** Portal / Home destinations gated by venue planning capabilities. */
export function isPortalSectionEnabledByCapabilities(
  section: string,
  caps: VenuePlanningCapabilities,
): boolean {
  switch (section) {
    case "timeline":
      return caps.timeline;
    case "floor_plans":
      return caps.floorPlan;
    case "seating":
      return caps.seating;
    case "vendors":
      return caps.vendors;
    case "inventory":
      return caps.inventory;
    case "event-order":
    case "event_order":
      return caps.eventOrder;
    case "questionnaire":
    case "questionnaires":
      return caps.questionnaires;
    default:
      return true;
  }
}

export function capabilitiesFromVenueRow(row: {
  planning_checklists_enabled?: boolean | null;
  planning_timeline_enabled?: boolean | null;
  planning_floor_plan_enabled?: boolean | null;
  planning_seating_enabled?: boolean | null;
  planning_vendors_enabled?: boolean | null;
  planning_inventory_enabled?: boolean | null;
  planning_event_order_enabled?: boolean | null;
  planning_questionnaires_enabled?: boolean | null;
} | null | undefined): VenuePlanningCapabilities {
  if (!row) return { ...DEFAULT_PLANNING_CAPABILITIES };
  return {
    checklists: row.planning_checklists_enabled ?? true,
    timeline: row.planning_timeline_enabled ?? true,
    floorPlan: row.planning_floor_plan_enabled ?? true,
    seating: row.planning_seating_enabled ?? true,
    vendors: row.planning_vendors_enabled ?? true,
    inventory: row.planning_inventory_enabled ?? true,
    eventOrder: row.planning_event_order_enabled ?? true,
    questionnaires: row.planning_questionnaires_enabled ?? true,
  };
}

export function capabilitiesFromVenue(venue: {
  planningChecklistsEnabled?: boolean;
  planningTimelineEnabled?: boolean;
  planningFloorPlanEnabled?: boolean;
  planningSeatingEnabled?: boolean;
  planningVendorsEnabled?: boolean;
  planningInventoryEnabled?: boolean;
  planningEventOrderEnabled?: boolean;
  planningQuestionnairesEnabled?: boolean;
} | null | undefined): VenuePlanningCapabilities {
  if (!venue) return { ...DEFAULT_PLANNING_CAPABILITIES };
  return {
    checklists: venue.planningChecklistsEnabled ?? true,
    timeline: venue.planningTimelineEnabled ?? true,
    floorPlan: venue.planningFloorPlanEnabled ?? true,
    seating: venue.planningSeatingEnabled ?? true,
    vendors: venue.planningVendorsEnabled ?? true,
    inventory: venue.planningInventoryEnabled ?? true,
    eventOrder: venue.planningEventOrderEnabled ?? true,
    questionnaires: venue.planningQuestionnairesEnabled ?? true,
  };
}
