/**
 * Floor Plans — seating-in-use designation + proposed layout replacement review.
 * Ordinary couple selection no longer requires Approve / Decline / Defer.
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
  normalizeCouplePreferenceStatus,
  type CouplePreferenceStatus,
  type PreferenceApprovalCase,
} from "@/lib/floor-plans/preference-lifecycle";
import { nextStateAfterAcceptProposedReplacement } from "@/lib/floor-plans/selection-lifecycle";
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

export type ProposedReplacementDecisionInput =
  | { decision: "decline" }
  | {
      decision: "accept";
      seatingChoice?: "start_on_proposed";
      seatingInUseFloorPlanId?: string;
    };

/**
 * Venue accepts or declines a post-approval proposed layout replacement.
 * Ordinary initial selection does not use this path.
 */
export async function decideProposedLayoutReplacement(
  eventId: string,
  input: ProposedReplacementDecisionInput,
): Promise<FloorPlanActionResult> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    const row = await repo.getEventFloorPlanPreferenceState(supabase, venueId, eventId);
    if (!row) return { ok: false as const, message: "Event not found." };
    const proposedId = row.couple_selected_floor_plan_id;
    if (!proposedId || row.couple_preference_status !== "proposed_replacement") {
      return {
        ok: false as const,
        message: "There is no proposed layout replacement to review.",
      };
    }
    const operationalId = row.operational_floor_plan_id;

    if (input.decision === "decline") {
      await repo.updateEventFloorPlanPreferenceState(supabase, venueId, eventId, {
        couple_selected_floor_plan_id: operationalId,
        couple_preference_status: operationalId ? "applied" : null,
      });
      return { ok: true as const };
    }

    const currentSeatCount = operationalId
      ? await repo.countGuestSeatAssignments(supabase, operationalId, venueId)
      : 0;
    const proposedSeatCount = await repo.countGuestSeatAssignments(
      supabase,
      proposedId,
      venueId,
    );
    const next = nextStateAfterAcceptProposedReplacement({
      proposedFloorPlanId: proposedId,
      operationalFloorPlanId: operationalId,
      seatingInUseFloorPlanId: row.seating_in_use_floor_plan_id,
      currentHasSeats: currentSeatCount > 0,
      proposedHasSeats: proposedSeatCount > 0,
      seatingChoice: input.seatingChoice,
      seatingInUseFloorPlanIdChoice: input.seatingInUseFloorPlanId,
    });
    if (!next.ok) return { ok: false as const, message: next.message };

    // Share the new working plan; do not rewrite seating assignment rows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("floor_plans") as any)
      .update({ shared_with_couple: true })
      .eq("id", next.operationalFloorPlanId)
      .eq("venue_id", venueId)
      .eq("event_id", eventId);

    await repo.updateEventFloorPlanPreferenceState(supabase, venueId, eventId, {
      couple_selected_floor_plan_id: next.operationalFloorPlanId,
      couple_preference_status: next.selectionStatus,
      operational_floor_plan_id: next.operationalFloorPlanId,
      seating_in_use_floor_plan_id: next.seatingInUseFloorPlanId,
    });
    return { ok: true as const };
  });
  return result as FloorPlanActionResult;
}

/**
 * @deprecated Ordinary selection no longer requires venue preference approval.
 * Kept as a thin alias for proposed-replacement accept during transition tests.
 */
export async function decideCoupleFloorPlanPreference(
  eventId: string,
  input:
    | { decision: "decline" }
    | { decision: "defer" }
    | { decision: "approve"; seatingChoice?: "start_on_preferred"; seatingInUseFloorPlanId?: string },
): Promise<FloorPlanActionResult> {
  if (input.decision === "defer") {
    return { ok: false, message: "Preference deferral was removed. Selection no longer requires venue approval." };
  }
  if (input.decision === "decline") {
    return decideProposedLayoutReplacement(eventId, { decision: "decline" });
  }
  return decideProposedLayoutReplacement(eventId, {
    decision: "accept",
    seatingChoice:
      input.seatingChoice === "start_on_preferred" ? "start_on_proposed" : undefined,
    seatingInUseFloorPlanId: input.seatingInUseFloorPlanId,
  });
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
