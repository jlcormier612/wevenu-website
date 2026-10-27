/**
 * Floor Plans Phase 2 — venue preference review + seating-in-use designation.
 * Server-only. Never rewrites guest_seat_assignments rows.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  canEditFloorPlans,
  FLOOR_PLAN_EDIT_DENIED,
} from "@/lib/floor-plans/authorize";
import * as repo from "@/lib/floor-plans/repository";
import {
  classifyPreferenceApprovalCase,
  nextPreferenceState,
  normalizeCouplePreferenceStatus,
  type CouplePreferenceStatus,
  type PreferenceApprovalCase,
} from "@/lib/floor-plans/preference-lifecycle";
import type { FloorPlanActionResult } from "@/lib/floor-plans/types";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

async function withVenueEditor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | FloorPlanActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  const role = await getCurrentUserRole();
  if (!canEditFloorPlans(role)) {
    return { ok: false, message: FLOOR_PLAN_EDIT_DENIED };
  }
  return fn(supabase, venue.id);
}

export type PreferenceReviewSnapshot = {
  coupleSelectedFloorPlanId: string | null;
  coupleApprovedFloorPlanId: string | null;
  couplePreferenceStatus: CouplePreferenceStatus | null;
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  approvalCase: PreferenceApprovalCase | null;
  currentSeatCount: number;
  preferredSeatCount: number;
};

export async function getPreferenceReviewSnapshot(
  eventId: string,
): Promise<PreferenceReviewSnapshot | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const row = await repo.getEventFloorPlanPreferenceState(supabase, venue.id, eventId);
  if (!row) return null;
  const preferredId = row.couple_selected_floor_plan_id;
  const operationalId = row.operational_floor_plan_id;
  const status = normalizeCouplePreferenceStatus(
    row.couple_preference_status,
    preferredId,
  );
  let currentSeatCount = 0;
  let preferredSeatCount = 0;
  if (operationalId) {
    currentSeatCount = await repo.countGuestSeatAssignments(supabase, operationalId);
  }
  if (preferredId) {
    preferredSeatCount = await repo.countGuestSeatAssignments(supabase, preferredId);
  }
  const approvalCase =
    preferredId && status === "pending"
      ? classifyPreferenceApprovalCase({
          currentOperationalId: operationalId,
          preferredId,
          currentHasSeats: currentSeatCount > 0,
          preferredHasSeats: preferredSeatCount > 0,
        })
      : null;
  return {
    coupleSelectedFloorPlanId: preferredId,
    coupleApprovedFloorPlanId: row.couple_approved_floor_plan_id,
    couplePreferenceStatus: status,
    operationalFloorPlanId: operationalId,
    seatingInUseFloorPlanId: row.seating_in_use_floor_plan_id,
    approvalCase,
    currentSeatCount,
    preferredSeatCount,
  };
}

export type VenuePreferenceDecisionInput =
  | { decision: "decline" }
  | { decision: "defer" }
  | { decision: "approve"; seatingChoice?: "start_on_preferred"; seatingInUseFloorPlanId?: string };

/**
 * Venue decides a pending preference. Idempotent for identical outcomes.
 * Cancel is a no-op at the UI (never call this). Failures leave prior state.
 */
export async function decideCoupleFloorPlanPreference(
  eventId: string,
  input: VenuePreferenceDecisionInput,
): Promise<FloorPlanActionResult> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    const row = await repo.getEventFloorPlanPreferenceState(supabase, venueId, eventId);
    if (!row) return { ok: false as const, message: "Event not found." };
    const preferredId = row.couple_selected_floor_plan_id;
    if (!preferredId) {
      return { ok: false as const, message: "There is no couple preference to review." };
    }
    const status = normalizeCouplePreferenceStatus(
      row.couple_preference_status,
      preferredId,
    );
    const operationalId = row.operational_floor_plan_id;
    const currentSeatCount = operationalId
      ? await repo.countGuestSeatAssignments(supabase, operationalId, venueId)
      : 0;
    const preferredSeatCount = await repo.countGuestSeatAssignments(
      supabase,
      preferredId,
      venueId,
    );
    const approvalCase = classifyPreferenceApprovalCase({
      currentOperationalId: operationalId,
      preferredId,
      currentHasSeats: currentSeatCount > 0,
      preferredHasSeats: preferredSeatCount > 0,
    });

    let decision;
    if (input.decision === "decline" || input.decision === "defer") {
      decision = { decision: input.decision } as const;
    } else if (approvalCase === "A") {
      decision = { decision: "approve" as const, case: "A" as const };
    } else if (approvalCase === "B") {
      if (input.seatingChoice !== "start_on_preferred") {
        return {
          ok: false as const,
          message:
            "This working layout already has seating. Choose “Approve and start seating on the preferred layout” (seats stay on the current layout), or Decline / Defer to keep the current arrangement.",
        };
      }
      decision = {
        decision: "approve" as const,
        case: "B" as const,
        seatingChoice: "start_on_preferred" as const,
      };
    } else {
      const inUse = input.seatingInUseFloorPlanId?.trim() || null;
      if (!inUse || (inUse !== preferredId && inUse !== operationalId)) {
        return {
          ok: false as const,
          message: "Both layouts have seating. Choose which seating arrangement is in use before approving.",
        };
      }
      decision = {
        decision: "approve" as const,
        case: "C" as const,
        seatingInUseFloorPlanId: inUse,
      };
    }

    const next = nextPreferenceState({
      coupleSelectedFloorPlanId: preferredId,
      coupleApprovedFloorPlanId: row.couple_approved_floor_plan_id,
      couplePreferenceStatus: status,
      operationalFloorPlanId: operationalId,
      seatingInUseFloorPlanId: row.seating_in_use_floor_plan_id,
      decision,
    });
    if (!next.ok) return { ok: false as const, message: next.message };

    // Idempotent: identical write is a no-op success.
    const unchanged =
      next.coupleSelectedFloorPlanId === row.couple_selected_floor_plan_id
      && next.coupleApprovedFloorPlanId === row.couple_approved_floor_plan_id
      && next.couplePreferenceStatus === (row.couple_preference_status ?? status)
      && next.operationalFloorPlanId === row.operational_floor_plan_id
      && next.seatingInUseFloorPlanId === row.seating_in_use_floor_plan_id;
    if (unchanged) return { ok: true as const };

    await repo.updateEventFloorPlanPreferenceState(supabase, venueId, eventId, {
      couple_selected_floor_plan_id: next.coupleSelectedFloorPlanId,
      couple_approved_floor_plan_id: next.coupleApprovedFloorPlanId,
      couple_preference_status: next.couplePreferenceStatus,
      operational_floor_plan_id: next.operationalFloorPlanId,
      seating_in_use_floor_plan_id: next.seatingInUseFloorPlanId,
    });
    return { ok: true as const };
  });
  return result as FloorPlanActionResult;
}

/** Explicit seating-in-use designation. Does not change preference or share. */
export async function setSeatingInUseFloorPlan(
  eventId: string,
  floorPlanId: string | null,
): Promise<FloorPlanActionResult> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    if (floorPlanId) {
      const { data: plan } = await supabase
        .from("floor_plans")
        .select("id")
        .eq("id", floorPlanId)
        .eq("event_id", eventId)
        .eq("venue_id", venueId)
        .maybeSingle();
      if (!plan) return { ok: false as const, message: "Floor plan not found on this event." };
    }
    await repo.setEventSeatingInUseFloorPlan(supabase, venueId, eventId, floorPlanId);
    return { ok: true as const };
  });
  return result as FloorPlanActionResult;
}

/**
 * When an offer is withdrawn and the pending preference points at that offer's
 * clone, mark preference withdrawn. Never deletes layouts or seats.
 */
export async function markPreferenceWithdrawnIfOfferClone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
  templateId: string,
): Promise<void> {
  const row = await repo.getEventFloorPlanPreferenceState(supabase, venueId, eventId);
  if (!row?.couple_selected_floor_plan_id) return;
  const status = normalizeCouplePreferenceStatus(
    row.couple_preference_status,
    row.couple_selected_floor_plan_id,
  );
  if (status !== "pending") return;

  const { data: plan } = await supabase
    .from("floor_plans")
    .select("id, source_template_id")
    .eq("id", row.couple_selected_floor_plan_id)
    .eq("event_id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string; source_template_id: string | null }>();
  if (!plan || plan.source_template_id !== templateId) return;

  await repo.updateEventFloorPlanPreferenceState(supabase, venueId, eventId, {
    couple_preference_status: "withdrawn",
  });
}
