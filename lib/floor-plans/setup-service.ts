/**
 * Floor Plans Phase 3 — venue setup authoring + proposed-replacement review.
 * Couple selection establishes setup working layout (no Approve/Decline/Defer).
 * Never infers setup names. Detach ≠ delete layout/seats.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  canEditFloorPlans,
  FLOOR_PLAN_EDIT_DENIED,
} from "@/lib/floor-plans/authorize";
import {
  classifyPreferenceApprovalCase,
  normalizeCouplePreferenceStatus,
  type PreferenceApprovalCase,
} from "@/lib/floor-plans/preference-lifecycle";
import { nextStateAfterAcceptProposedReplacement } from "@/lib/floor-plans/selection-lifecycle";
import * as repo from "@/lib/floor-plans/repository";
import {
  mapSetupRow,
  type SetupWithMembers,
} from "@/lib/floor-plans/setups";
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

export async function listSetupsWithMembers(
  eventId: string,
): Promise<SetupWithMembers[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const setups = await repo.listEventFloorPlanSetups(supabase, venue.id, eventId);
  const members = await repo.listSetupMembersForEvent(supabase, venue.id, eventId);
  return setups.map((s) => {
    const mapped = mapSetupRow(s);
    return {
      ...mapped,
      members: members
        .filter((m) => m.setup_id === s.id)
        .map((m) => ({
          id: m.id,
          venueId: m.venue_id,
          setupId: m.setup_id,
          floorPlanId: m.floor_plan_id,
          sortOrder: m.sort_order,
          floorPlanName: m.floor_plan_name,
          sharedWithCouple: m.shared_with_couple,
        })),
    };
  });
}

export async function createRequiredSetup(
  eventId: string,
  name: string,
): Promise<FloorPlanActionResult & { setupId?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Enter a setup name (for example Ceremony or Reception)." };
  const result = await withVenueEditor(async (supabase, venueId) => {
    const existing = await repo.listEventFloorPlanSetups(supabase, venueId, eventId);
    const row = await repo.insertEventFloorPlanSetup(supabase, {
      venueId,
      eventId,
      name: trimmed,
      sortOrder: existing.length,
    });
    return { ok: true as const, setupId: row.id };
  });
  return result as FloorPlanActionResult & { setupId?: string };
}

/** Default multi-part wedding packaging: Ceremony + Reception when none exist yet. */
export const DEFAULT_WEDDING_SETUP_NAMES = ["Ceremony", "Reception"] as const;

/**
 * Opt-in default for multi-part weddings. Never backfills events that already
 * have setups (including a single custom setup).
 */
export async function ensureDefaultWeddingSetups(
  eventId: string,
): Promise<FloorPlanActionResult & { created?: string[] }> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    const existing = await repo.listEventFloorPlanSetups(supabase, venueId, eventId);
    if (existing.length > 0) {
      return {
        ok: true as const,
        created: [] as string[],
        message: "This event already has wedding setups.",
      };
    }
    const created: string[] = [];
    for (let i = 0; i < DEFAULT_WEDDING_SETUP_NAMES.length; i += 1) {
      const name = DEFAULT_WEDDING_SETUP_NAMES[i]!;
      await repo.insertEventFloorPlanSetup(supabase, {
        venueId,
        eventId,
        name,
        sortOrder: i,
      });
      created.push(name);
    }
    return { ok: true as const, created };
  });
  return result as FloorPlanActionResult & { created?: string[] };
}

export async function renameRequiredSetup(
  eventId: string,
  setupId: string,
  name: string,
): Promise<FloorPlanActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Setup name cannot be empty." };
  return withVenueEditor(async (supabase, venueId) => {
    const setup = await repo.getSetupById(supabase, venueId, setupId);
    if (!setup || setup.event_id !== eventId) {
      return { ok: false as const, message: "Setup not found." };
    }
    await repo.updateEventFloorPlanSetup(supabase, venueId, setupId, { name: trimmed });
    return { ok: true as const };
  });
}

export async function removeRequiredSetup(
  eventId: string,
  setupId: string,
): Promise<FloorPlanActionResult> {
  return withVenueEditor(async (supabase, venueId) => {
    const setup = await repo.getSetupById(supabase, venueId, setupId);
    if (!setup || setup.event_id !== eventId) {
      return { ok: false as const, message: "Setup not found." };
    }
    // Members cascade via FK on setup delete — layouts and seats remain.
    await repo.deleteEventFloorPlanSetup(supabase, venueId, setupId);
    return { ok: true as const };
  });
}

export async function attachLayoutToSetup(
  eventId: string,
  setupId: string,
  floorPlanId: string,
): Promise<FloorPlanActionResult> {
  return withVenueEditor(async (supabase, venueId) => {
    const setup = await repo.getSetupById(supabase, venueId, setupId);
    if (!setup || setup.event_id !== eventId) {
      return { ok: false as const, message: "Setup not found." };
    }
    const { data: plan, error } = await supabase
      .from("floor_plans")
      .select("id, event_id")
      .eq("id", floorPlanId)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (error) throw error;
    if (!plan || plan.event_id !== eventId) {
      return { ok: false as const, message: "That layout is not on this event." };
    }
    const members = await repo.listSetupMembersForEvent(supabase, venueId, eventId);
    if (members.some((m) => m.floor_plan_id === floorPlanId)) {
      return {
        ok: false as const,
        message: "That layout already belongs to a setup. Detach it first.",
      };
    }
    const setupMembers = members.filter((m) => m.setup_id === setupId);
    await repo.insertSetupMember(supabase, {
      venueId,
      setupId,
      floorPlanId,
      sortOrder: setupMembers.length,
    });
    // First layout becomes working layout for the setup when unset.
    if (!setup.operational_floor_plan_id) {
      await repo.updateEventFloorPlanSetup(supabase, venueId, setupId, {
        operational_floor_plan_id: floorPlanId,
      });
    }
    return { ok: true as const };
  });
}

/** Detach membership only — preserves layout, seating, and collaboration state. */
export async function detachLayoutFromSetup(
  eventId: string,
  setupId: string,
  floorPlanId: string,
): Promise<FloorPlanActionResult> {
  return withVenueEditor(async (supabase, venueId) => {
    const setup = await repo.getSetupById(supabase, venueId, setupId);
    if (!setup || setup.event_id !== eventId) {
      return { ok: false as const, message: "Setup not found." };
    }
    await repo.deleteSetupMember(supabase, venueId, setupId, floorPlanId);
    const patch: Parameters<typeof repo.updateEventFloorPlanSetup>[3] = {};
    if (setup.couple_selected_floor_plan_id === floorPlanId) {
      patch.couple_selected_floor_plan_id = null;
      patch.couple_preference_status = null;
    }
    if (setup.couple_approved_floor_plan_id === floorPlanId) {
      patch.couple_approved_floor_plan_id = null;
    }
    if (setup.operational_floor_plan_id === floorPlanId) {
      patch.operational_floor_plan_id = null;
    }
    if (setup.seating_in_use_floor_plan_id === floorPlanId) {
      patch.seating_in_use_floor_plan_id = null;
    }
    if (Object.keys(patch).length > 0) {
      await repo.updateEventFloorPlanSetup(supabase, venueId, setupId, patch);
    }
    return { ok: true as const };
  });
}

export async function setSetupWorkingLayout(
  eventId: string,
  setupId: string,
  floorPlanId: string,
): Promise<FloorPlanActionResult> {
  return withVenueEditor(async (supabase, venueId) => {
    const setup = await repo.getSetupById(supabase, venueId, setupId);
    if (!setup || setup.event_id !== eventId) {
      return { ok: false as const, message: "Setup not found." };
    }
    const members = await repo.listSetupMembersForEvent(supabase, venueId, eventId);
    if (!members.some((m) => m.setup_id === setupId && m.floor_plan_id === floorPlanId)) {
      return { ok: false as const, message: "Layout is not part of this setup." };
    }
    await repo.updateEventFloorPlanSetup(supabase, venueId, setupId, {
      operational_floor_plan_id: floorPlanId,
    });
    return { ok: true as const };
  });
}

export type SetupPreferenceReviewSnapshot = {
  setupId: string;
  setupName: string;
  coupleSelectedFloorPlanId: string | null;
  coupleApprovedFloorPlanId: string | null;
  couplePreferenceStatus: ReturnType<typeof normalizeCouplePreferenceStatus>;
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  approvalCase: PreferenceApprovalCase | null;
  currentSeatCount: number;
  preferredSeatCount: number;
};

export async function getSetupPreferenceReviewSnapshot(
  eventId: string,
  setupId: string,
): Promise<SetupPreferenceReviewSnapshot | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const setup = await repo.getSetupById(supabase, venue.id, setupId);
  if (!setup || setup.event_id !== eventId) return null;
  const preferredId = setup.couple_selected_floor_plan_id;
  const operationalId = setup.operational_floor_plan_id;
  const status = normalizeCouplePreferenceStatus(
    setup.couple_preference_status,
    preferredId,
  );
  const currentSeatCount = operationalId
    ? await repo.countGuestSeatAssignments(supabase, operationalId, venue.id)
    : 0;
  const preferredSeatCount = preferredId
    ? await repo.countGuestSeatAssignments(supabase, preferredId, venue.id)
    : 0;
  const approvalCase =
    preferredId && setup.couple_preference_status === "proposed_replacement"
      ? classifyPreferenceApprovalCase({
          currentOperationalId: operationalId,
          preferredId,
          currentHasSeats: currentSeatCount > 0,
          preferredHasSeats: preferredSeatCount > 0,
        })
      : null;
  return {
    setupId: setup.id,
    setupName: setup.name,
    coupleSelectedFloorPlanId: preferredId,
    coupleApprovedFloorPlanId: setup.couple_approved_floor_plan_id,
    couplePreferenceStatus: status,
    operationalFloorPlanId: operationalId,
    seatingInUseFloorPlanId: setup.seating_in_use_floor_plan_id,
    approvalCase,
    currentSeatCount,
    preferredSeatCount,
  };
}

export type SetupProposedReplacementInput =
  | { decision: "decline" }
  | {
      decision: "accept";
      seatingChoice?: "start_on_proposed";
      seatingInUseFloorPlanId?: string;
    }
  // Legacy aliases during transition — mapped to accept/decline.
  | { decision: "defer" }
  | {
      decision: "approve";
      seatingChoice?: "start_on_preferred";
      seatingInUseFloorPlanId?: string;
    };

/**
 * Venue accepts or declines a post-approval proposed layout replacement for one setup.
 * Ordinary couple selection does not use this path.
 * Never mutates other setups or guest_seat_assignments rows.
 */
export async function decideSetupFloorPlanPreference(
  eventId: string,
  setupId: string,
  input: SetupProposedReplacementInput,
): Promise<FloorPlanActionResult> {
  return withVenueEditor(async (supabase, venueId) => {
    const setup = await repo.getSetupById(supabase, venueId, setupId);
    if (!setup || setup.event_id !== eventId) {
      return { ok: false as const, message: "Setup not found." };
    }
    const proposedId = setup.couple_selected_floor_plan_id;
    if (!proposedId || setup.couple_preference_status !== "proposed_replacement") {
      return {
        ok: false as const,
        message: "There is no proposed layout replacement to review for this setup.",
      };
    }
    const operationalId = setup.operational_floor_plan_id;

    if (input.decision === "defer") {
      return {
        ok: false as const,
        message: "Preference deferral was removed. Selection no longer requires venue approval.",
      };
    }

    if (input.decision === "decline") {
      await repo.updateEventFloorPlanSetup(supabase, venueId, setupId, {
        couple_selected_floor_plan_id: operationalId,
        couple_preference_status: operationalId ? "applied" : null,
      });
      return { ok: true as const };
    }

    const seatingChoice =
      input.decision === "approve"
        ? (input.seatingChoice === "start_on_preferred" ? "start_on_proposed" as const : undefined)
        : input.seatingChoice;
    const seatingInUseChoice =
      input.decision === "approve" || input.decision === "accept"
        ? input.seatingInUseFloorPlanId
        : undefined;

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
      seatingInUseFloorPlanId: setup.seating_in_use_floor_plan_id,
      currentHasSeats: currentSeatCount > 0,
      proposedHasSeats: proposedSeatCount > 0,
      seatingChoice,
      seatingInUseFloorPlanIdChoice: seatingInUseChoice,
    });
    if (!next.ok) return { ok: false as const, message: next.message };

    await repo.updateEventFloorPlanSetup(supabase, venueId, setupId, {
      couple_selected_floor_plan_id: next.operationalFloorPlanId,
      couple_preference_status: next.selectionStatus,
      operational_floor_plan_id: next.operationalFloorPlanId,
      seating_in_use_floor_plan_id: next.seatingInUseFloorPlanId,
    });
    return { ok: true as const };
  });
}
