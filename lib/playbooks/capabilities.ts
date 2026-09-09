/**
 * Venue planning capabilities — optional surfaces that are not themselves
 * Planning Template applications (Timeline, Floor Plan, Seating, Vendors).
 * Distinct from event_tasks: a capability is what the venue offers; a task
 * is checklist work that may reference a capability.
 */

import type { TaskActionType } from "@/lib/playbooks/types";

export type PlanningCapabilityId = "timeline" | "floor_plan" | "seating" | "vendors";

export type VenuePlanningCapabilities = {
  timeline: boolean;
  floorPlan: boolean;
  seating: boolean;
  vendors: boolean;
};

export const DEFAULT_PLANNING_CAPABILITIES: VenuePlanningCapabilities = {
  timeline: true,
  floorPlan: true,
  seating: true,
  vendors: true,
};

export const PLANNING_CAPABILITY_OPTIONS: {
  id: PlanningCapabilityId;
  key: keyof VenuePlanningCapabilities;
  label: string;
  description: string;
}[] = [
  {
    id: "timeline",
    key: "timeline",
    label: "Timeline",
    description: "Day-of schedule planning with your clients.",
  },
  {
    id: "floor_plan",
    key: "floorPlan",
    label: "Floor Plan",
    description: "Room layouts and physical placement.",
  },
  {
    id: "seating",
    key: "seating",
    label: "Seating",
    description: "Guest seating charts (usually with a shared floor plan).",
  },
  {
    id: "vendors",
    key: "vendors",
    label: "Preferred Vendors",
    description: "Vendor recommendations and client vendor choices.",
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
    case "timeline":
      return caps.timeline;
    case "floor_plan":
      return caps.floorPlan;
    case "seating":
      return caps.seating;
    case "vendors":
      return caps.vendors;
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
    default:
      return true;
  }
}

export function capabilitiesFromVenueRow(row: {
  planning_timeline_enabled?: boolean | null;
  planning_floor_plan_enabled?: boolean | null;
  planning_seating_enabled?: boolean | null;
  planning_vendors_enabled?: boolean | null;
} | null | undefined): VenuePlanningCapabilities {
  if (!row) return { ...DEFAULT_PLANNING_CAPABILITIES };
  return {
    timeline: row.planning_timeline_enabled ?? true,
    floorPlan: row.planning_floor_plan_enabled ?? true,
    seating: row.planning_seating_enabled ?? true,
    vendors: row.planning_vendors_enabled ?? true,
  };
}
