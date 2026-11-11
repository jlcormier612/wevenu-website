/**
 * Floor Plans Phase 5 — open / clear / reconcile review flags.
 * Clear mutates flag audit fields only. Never seating, layouts, flips, or ops.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  canEditFloorPlans,
  FLOOR_PLAN_EDIT_DENIED,
} from "@/lib/floor-plans/authorize";
import * as flagRepo from "@/lib/floor-plans/review-flag-repository";
import {
  bookingRoomSetFromSources,
  flipSnapshotMismatch,
  layoutRoomInconsistentWithBooking,
  setsEqual,
  t1BookingFingerprint,
  t1LayoutFingerprint,
  t3Fingerprint,
  type ReviewFlagRow,
  type ReviewFlagTriggerCode,
} from "@/lib/floor-plans/review-flags";
import * as repo from "@/lib/floor-plans/repository";
import type { FloorPlanActionResult } from "@/lib/floor-plans/types";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export type ReviewFlagActionResult =
  | { ok: true; flag?: ReviewFlagRow; flagWarning?: string }
  | { ok: false; message: string };

async function withVenueEditor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, userId: string) => Promise<T>,
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
  return fn(supabase, venue.id, user.id);
}

export async function listOpenReviewFlagsForEvent(
  eventId: string,
): Promise<ReviewFlagRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return flagRepo.listReviewFlagsForEvent(supabase, venue.id, eventId, "open");
}

async function loadBookingRoomSet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
): Promise<string[]> {
  const { data: assignments } = await supabase
    .from("event_space_assignments")
    .select("space_id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId);
  const { data: eventRow } = await supabase
    .from("events")
    .select("space_id")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{ space_id: string | null }>();
  return bookingRoomSetFromSources({
    assignmentSpaceIds: ((assignments ?? []) as { space_id: string }[]).map((a) => a.space_id),
    primarySpaceId: eventRow?.space_id ?? null,
  });
}

async function openOrRefreshFlag(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
  input: {
    targetKind: "layout" | "flip";
    floorPlanId: string | null;
    flipId: string | null;
    triggerCode: ReviewFlagTriggerCode;
    reasonCode: string;
    reasonSummary: string;
    contextJson: Record<string, unknown>;
    fingerprint: string;
  },
): Promise<"created" | "refreshed" | "unchanged" | "skipped_cleared_retry"> {
  const open = await flagRepo.getOpenFlag(supabase, venueId, eventId, {
    targetKind: input.targetKind,
    floorPlanId: input.floorPlanId,
    flipId: input.flipId,
    triggerCode: input.triggerCode,
  });
  if (open) {
    if (open.fingerprint === input.fingerprint) return "unchanged";
    await flagRepo.refreshOpenFlag(supabase, venueId, open.id, {
      reasonCode: input.reasonCode,
      reasonSummary: input.reasonSummary,
      contextJson: input.contextJson,
      fingerprint: input.fingerprint,
    });
    return "refreshed";
  }

  const clearedSame = await flagRepo.getLatestClearedWithFingerprint(
    supabase,
    venueId,
    eventId,
    input.fingerprint,
  );
  if (clearedSame) return "skipped_cleared_retry";

  await flagRepo.insertOpenFlag(supabase, {
    venueId,
    eventId,
    targetKind: input.targetKind,
    floorPlanId: input.floorPlanId,
    flipId: input.flipId,
    triggerCode: input.triggerCode,
    reasonCode: input.reasonCode,
    reasonSummary: input.reasonSummary,
    contextJson: input.contextJson,
    fingerprint: input.fingerprint,
  });
  return "created";
}

/**
 * After a successful booking-room mutation: flag layouts whose room left the set.
 * Call only after the booking mutation committed.
 */
export async function reconcileT1BookingRoomFlags(
  eventId: string,
  opts?: { previousBookingRoomSet?: string[] },
): Promise<{ ok: true; flagWarning?: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: true };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  try {
    const afterSet = await loadBookingRoomSet(supabase, venue.id, eventId);
    if (
      opts?.previousBookingRoomSet
      && setsEqual(opts.previousBookingRoomSet, afterSet)
    ) {
      return { ok: true };
    }

    // Empty booking room set: no established room relationship to conflict with.
    if (afterSet.length === 0) {
      await reconcileT3ForEvent(supabase, venue.id, eventId);
      return { ok: true };
    }

    const plans = await repo.getFloorPlansByEvent(supabase, venue.id, eventId);
    for (const plan of plans) {
      if (!plan.spaceId) continue;
      if (!layoutRoomInconsistentWithBooking(plan.spaceId, afterSet)) continue;
      await openOrRefreshFlag(supabase, venue.id, eventId, {
        targetKind: "layout",
        floorPlanId: plan.id,
        flipId: null,
        triggerCode: "t1_booking_room",
        reasonCode: "layout_room_not_in_booking_set",
        reasonSummary:
          `${plan.name} is linked to a room that is no longer among this booking’s assigned rooms. Review the layout room or the booking rooms.`,
        contextJson: {
          layoutSpaceId: plan.spaceId,
          bookingRoomIds: afterSet,
          layoutName: plan.name,
        },
        fingerprint: t1BookingFingerprint(plan.id, plan.spaceId, afterSet),
      });
    }

    await reconcileT3ForEvent(supabase, venue.id, eventId);
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    console.error("[reconcileT1BookingRoomFlags]", { eventId, detail });
    return {
      ok: true,
      flagWarning:
        "Rooms were saved, but layout review flags could not be updated. Refresh and try again, or contact support if this continues.",
    };
  }
}

export async function captureBookingRoomSetBeforeMutation(
  eventId: string,
): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return loadBookingRoomSet(supabase, venue.id, eventId);
}

async function reconcileT3ForEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
): Promise<void> {
  const flipRow = await repo.getEventFloorPlanFlip(supabase, venueId, eventId);
  if (!flipRow?.room_snapshot_captured_at) return;

  const before = await repo.getFloorPlan(supabase, venueId, flipRow.before_floor_plan_id);
  const after = await repo.getFloorPlan(supabase, venueId, flipRow.after_floor_plan_id);
  const curBefore = before?.spaceId ?? null;
  const curAfter = after?.spaceId ?? null;
  const recBefore = flipRow.recorded_before_space_id ?? null;
  const recAfter = flipRow.recorded_after_space_id ?? null;

  if (
    !flipSnapshotMismatch({
      roomSnapshotCapturedAt: flipRow.room_snapshot_captured_at,
      recordedBeforeSpaceId: recBefore,
      recordedAfterSpaceId: recAfter,
      currentBeforeSpaceId: curBefore,
      currentAfterSpaceId: curAfter,
    })
  ) {
    return;
  }

  await openOrRefreshFlag(supabase, venueId, eventId, {
    targetKind: "flip",
    floorPlanId: null,
    flipId: flipRow.id,
    triggerCode: "t3_flip_snapshot",
    reasonCode: "flip_recorded_rooms_mismatch",
    reasonSummary:
      "The rooms recorded when this before/after flip was linked no longer match the linked layouts’ rooms. Review the flip and layout rooms — clearing does not change them.",
    contextJson: {
      recordedBeforeSpaceId: recBefore,
      recordedAfterSpaceId: recAfter,
      currentBeforeSpaceId: curBefore,
      currentAfterSpaceId: curAfter,
      beforeName: before?.name ?? null,
      afterName: after?.name ?? null,
    },
    fingerprint: t3Fingerprint(flipRow.id, recBefore, recAfter, curBefore, curAfter),
  });
}

export async function updateFloorPlanSpace(
  eventId: string,
  floorPlanId: string,
  spaceId: string | null,
): Promise<ReviewFlagActionResult> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    const plan = await repo.getFloorPlan(supabase, venueId, floorPlanId);
    if (!plan || plan.eventId !== eventId) {
      return { ok: false as const, message: "Floor plan not found on this event." };
    }
    const next = spaceId?.trim() || null;
    const prev = plan.spaceId ?? null;
    if (prev === next) return { ok: true as const };

    try {
      await flagRepo.updateFloorPlanSpaceId(supabase, venueId, floorPlanId, next);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown";
      return { ok: false as const, message: `Could not update the layout room (${detail}).` };
    }

    let flagWarning: string | undefined;
    try {
      const bookingSet = await loadBookingRoomSet(supabase, venueId, eventId);
      if (
        next
        && bookingSet.length > 0
        && layoutRoomInconsistentWithBooking(next, bookingSet)
      ) {
        await openOrRefreshFlag(supabase, venueId, eventId, {
          targetKind: "layout",
          floorPlanId,
          flipId: null,
          triggerCode: "t1_layout_room",
          reasonCode: "layout_room_not_in_booking_set",
          reasonSummary: `${plan.name} was linked to a room that is not among this booking’s assigned rooms. Review the layout room or the booking rooms.`,
          contextJson: {
            layoutSpaceId: next,
            bookingRoomIds: bookingSet,
            layoutName: plan.name,
            previousSpaceId: prev,
          },
          fingerprint: t1LayoutFingerprint(floorPlanId, next, bookingSet),
        });
      }
      // Clearing space to null: do not create T1; do not silently clear open flags.
      await reconcileT3ForEvent(supabase, venueId, eventId);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown";
      console.error("[updateFloorPlanSpace] flag reconcile", { eventId, floorPlanId, detail });
      flagWarning =
        "Layout room was saved, but review flags could not be updated. Refresh and try again.";
    }
    return { ok: true as const, flagWarning };
  });
  return result as ReviewFlagActionResult;
}

export async function clearFloorPlanReviewFlag(
  eventId: string,
  flagId: string,
): Promise<ReviewFlagActionResult> {
  const result = await withVenueEditor(async (supabase, venueId, userId) => {
    const open = await flagRepo.listReviewFlagsForEvent(supabase, venueId, eventId, "open");
    const target = open.find((f) => f.id === flagId);
    if (!target) {
      return { ok: false as const, message: "That review is not open (or was already cleared)." };
    }
    const flag = await flagRepo.clearReviewFlag(supabase, venueId, flagId, userId);
    return { ok: true as const, flag };
  });
  return result as ReviewFlagActionResult;
}

/** Exported for flip-service after link — capture snapshot then evaluate T3. */
export async function afterFlipLinked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  eventId: string,
  flipId: string,
  beforeSpaceId: string | null,
  afterSpaceId: string | null,
): Promise<void> {
  await repo.updateEventFloorPlanFlipRoomSnapshot(supabase, venueId, eventId, {
    recordedBeforeSpaceId: beforeSpaceId,
    recordedAfterSpaceId: afterSpaceId,
  });
  await reconcileT3ForEvent(supabase, venueId, eventId);
  void flipId;
}
