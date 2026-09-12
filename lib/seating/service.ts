/**
 * Seating application service — venue-authenticated discovery and operational
 * reads. Couple seating goes through portal RPCs; venue discovery no longer
 * borrows a portal token.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import {
  canViewSeating,
  SEATING_VIEW_DENIED,
} from "@/lib/seating/authorize";
import { buildVenueSeatingFloorPlanSummaries } from "@/lib/seating/summaries";
import type { SeatingData, SeatingFloorPlanSummary } from "@/lib/portal/types";

export type SeatingReadinessSummary = {
  floorPlanShared: boolean;
  totalAttending: number;
  totalAssigned: number;
  needsReassignmentCount: number;
  /** Distinct empty-state signal for readiness copy. */
  planCount: number;
  sharedPlanCount: number;
  hasSubmission: boolean;
  isDelegated: boolean;
};

export type VenueSeatingFloorPlan = SeatingFloorPlanSummary & {
  sharedForSeating: boolean;
  hasAssignments: boolean;
};

/**
 * Venue-authenticated seating plan discovery for an event. Lists every floor
 * plan on the booking with seating flags — no portal token.
 */
export async function listVenueSeatingFloorPlans(eventId: string): Promise<VenueSeatingFloorPlan[]> {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const role = await getCurrentUserRole();
  if (!canViewSeating(role)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_venue_seating_floor_plans", {
    p_event_id: eventId,
  });

  // Prefer the SECURITY DEFINER RPC. If it isn't applied yet, fall back to
  // venue-RLS floor_plans reads (still no portal token) with conservative flags.
  if (error || data == null || (typeof data === "object" && !Array.isArray(data) && (data as { error?: string }).error)) {
    const { data: plans } = await supabase
      .from("floor_plans")
      .select("id, name, client_access")
      .eq("event_id", eventId)
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: true });
    return (plans ?? []).map((row: { id: string; name: string; client_access: string }) => ({
      id: row.id,
      name: row.name,
      sharedForSeating: row.client_access !== "hidden",
      isDelegated: false,
      hasAssignments: false,
      lastSubmission: null,
    }));
  }

  const rows = data as Array<{
    id: string;
    name: string;
    sharedForSeating: boolean;
    isDelegated: boolean;
    hasAssignments: boolean;
    lastSubmission: SeatingFloorPlanSummary["lastSubmission"];
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sharedForSeating: Boolean(row.sharedForSeating),
    isDelegated: Boolean(row.isDelegated),
    hasAssignments: Boolean(row.hasAssignments),
    lastSubmission: row.lastSubmission ?? null,
  }));
}

/** @deprecated Prefer listVenueSeatingFloorPlans — kept name for call-site clarity. */
export async function getSeatingFloorPlansForVenue(
  eventId: string,
): Promise<SeatingFloorPlanSummary[]> {
  const plans = await listVenueSeatingFloorPlans(eventId);
  return plans.map(({ id, name, isDelegated, lastSubmission }) => ({
    id, name, isDelegated, lastSubmission,
  }));
}

/**
 * Event Readiness seating summary — venue-auth, aggregated across plans
 * shared for seating. Does not borrow a portal token.
 */
export async function getSeatingReadinessSummaryForEvent(
  eventId: string,
): Promise<SeatingReadinessSummary | null> {
  const plans = await listVenueSeatingFloorPlans(eventId);
  const shared = plans.filter((p) => p.sharedForSeating);

  if (plans.length === 0) {
    return {
      floorPlanShared: false,
      totalAttending: 0,
      totalAssigned: 0,
      needsReassignmentCount: 0,
      planCount: 0,
      sharedPlanCount: 0,
      hasSubmission: false,
      isDelegated: false,
    };
  }

  if (shared.length === 0) {
    return {
      floorPlanShared: false,
      totalAttending: 0,
      totalAssigned: 0,
      needsReassignmentCount: 0,
      planCount: plans.length,
      sharedPlanCount: 0,
      hasSubmission: plans.some((p) => p.lastSubmission != null),
      isDelegated: false,
    };
  }

  // Aggregate live stats from each shared plan via operational/live reads only
  // when delegated; otherwise use submission snapshot counts for assigned and
  // leave attending as best-effort from any delegated live read.
  let totalAttending = 0;
  let totalAssigned = 0;
  let needsReassignmentCount = 0;
  let sawLive = false;

  for (const plan of shared) {
    const data = await getOperationalSeatingPlan(eventId, plan.id);
    if (!data) continue;
    if (data.notYetSubmitted && !data.isDelegated) {
      // Private draft — readiness must not expose live counts.
      if (plan.lastSubmission) {
        totalAssigned += plan.lastSubmission.count;
      }
      continue;
    }
    sawLive = true;
    totalAttending = Math.max(totalAttending, data.stats?.totalAttending ?? 0);
    totalAssigned += data.stats?.totalAssigned ?? 0;
    needsReassignmentCount += (data.needsReassignment ?? []).length;
  }

  if (!sawLive && shared.some((p) => p.lastSubmission)) {
    // Submitted but not delegated — attending unknown from snapshot alone;
    // surface assigned from submissions.
    totalAssigned = shared.reduce((sum, p) => sum + (p.lastSubmission?.count ?? 0), 0);
  }

  return {
    floorPlanShared: true,
    totalAttending,
    totalAssigned,
    needsReassignmentCount,
    planCount: plans.length,
    sharedPlanCount: shared.length,
    hasSubmission: shared.some((p) => p.lastSubmission != null),
    isDelegated: shared.some((p) => p.isDelegated),
  };
}

/** Back-compat shim — callers that still pass a portal token should migrate to eventId. */
export async function getSeatingReadinessSummary(
  portalTokenOrNull: string | null,
  eventId?: string,
): Promise<SeatingReadinessSummary | null> {
  if (eventId) return getSeatingReadinessSummaryForEvent(eventId);
  // Legacy path: without eventId we cannot venue-auth discover plans.
  if (!portalTokenOrNull) {
    return {
      floorPlanShared: false,
      totalAttending: 0,
      totalAssigned: 0,
      needsReassignmentCount: 0,
      planCount: 0,
      sharedPlanCount: 0,
      hasSubmission: false,
      isDelegated: false,
    };
  }
  return null;
}

export type OperationalSeatingPlan = SeatingData & {
  isDelegated: boolean;
  notYetSubmitted?: boolean;
  submittedAt?: string;
  submittedBy?: "couple" | "venue";
  delegatedAt?: string;
  delegatedNote?: string | null;
  delegationId?: string | null;
};

/**
 * The venue's operational read for one floor plan — venue-authenticated.
 * Private Until Committed: latest submission unless actively delegated.
 */
export async function getOperationalSeatingPlan(
  eventId: string,
  floorPlanId: string,
): Promise<OperationalSeatingPlan | null> {
  const role = await getCurrentUserRole();
  if (!canViewSeating(role)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_operational_seating_plan", {
    p_event_id: eventId,
    p_floor_plan_id: floorPlanId,
  });
  if (error || !data || (data as { error?: string }).error) return null;
  return data as OperationalSeatingPlan;
}

export { buildVenueSeatingFloorPlanSummaries, SEATING_VIEW_DENIED };
