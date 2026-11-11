/**
 * Floor Plans Phase 3 — required setups + setup-scoped alternatives.
 * Explicit setup identity only — never infer from layout/room/template names.
 */
import type { CouplePreferenceStatus } from "@/lib/floor-plans/preference-lifecycle";
import { normalizeCouplePreferenceStatus } from "@/lib/floor-plans/preference-lifecycle";

export type EventFloorPlanSetup = {
  id: string;
  venueId: string;
  eventId: string;
  name: string;
  sortOrder: number;
  coupleSelectedFloorPlanId: string | null;
  couplePreferenceStatus: CouplePreferenceStatus | null;
  coupleApprovedFloorPlanId: string | null;
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventFloorPlanSetupMember = {
  id: string;
  venueId: string;
  setupId: string;
  floorPlanId: string;
  sortOrder: number;
};

export type SetupWithMembers = EventFloorPlanSetup & {
  members: Array<EventFloorPlanSetupMember & { floorPlanName: string; sharedWithCouple: boolean }>;
};

export type PortalSetupLayout = {
  floorPlanId: string;
  name: string;
  sortOrder: number;
  sharedWithCouple: boolean;
  isPreference: boolean;
  isApproved: boolean;
  isWorking: boolean;
};

export type PortalSetupPackage = {
  setupId: string;
  name: string;
  sortOrder: number;
  coupleSelectedFloorPlanId: string | null;
  couplePreferenceStatus: string | null;
  coupleApprovedFloorPlanId: string | null;
  operationalFloorPlanId: string | null;
  layouts: PortalSetupLayout[];
};

/** True when the event has at least one explicit required setup. */
export function eventUsesSetupPackage(setupCount: number): boolean {
  return setupCount > 0;
}

/**
 * Package view is ready for the couple when every setup has ≥1 shared layout,
 * or when the venue has configured setups (even incomplete — portal shows honest empty).
 */
export function portalShouldShowPackageView(hasSetups: boolean): boolean {
  return hasSetups;
}

export function mapSetupRow(row: {
  id: string;
  venue_id: string;
  event_id: string;
  name: string;
  sort_order: number;
  couple_selected_floor_plan_id: string | null;
  couple_preference_status: string | null;
  couple_approved_floor_plan_id: string | null;
  operational_floor_plan_id: string | null;
  seating_in_use_floor_plan_id: string | null;
  created_at: string;
  updated_at: string;
}): EventFloorPlanSetup {
  return {
    id: row.id,
    venueId: row.venue_id,
    eventId: row.event_id,
    name: row.name,
    sortOrder: row.sort_order,
    coupleSelectedFloorPlanId: row.couple_selected_floor_plan_id,
    couplePreferenceStatus: normalizeCouplePreferenceStatus(
      row.couple_preference_status,
      row.couple_selected_floor_plan_id,
    ),
    coupleApprovedFloorPlanId: row.couple_approved_floor_plan_id,
    operationalFloorPlanId: row.operational_floor_plan_id,
    seatingInUseFloorPlanId: row.seating_in_use_floor_plan_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Alternatives under a setup = all members except the designated working/primary when present. */
export function alternativeMemberIds(
  members: Array<{ floorPlanId: string }>,
  operationalFloorPlanId: string | null,
): string[] {
  if (!operationalFloorPlanId) {
    return members.slice(1).map((m) => m.floorPlanId);
  }
  return members
    .filter((m) => m.floorPlanId !== operationalFloorPlanId)
    .map((m) => m.floorPlanId);
}

/** Choosing a preference for setup A must not list layouts from setup B. */
export function layoutsBelongOnlyToSetup(
  setupId: string,
  memberships: Array<{ setupId: string; floorPlanId: string }>,
  layoutIds: string[],
): boolean {
  const allowed = new Set(
    memberships.filter((m) => m.setupId === setupId).map((m) => m.floorPlanId),
  );
  return layoutIds.every((id) => allowed.has(id));
}
