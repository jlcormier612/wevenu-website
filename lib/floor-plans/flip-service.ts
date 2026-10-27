/**
 * Floor Plans Phase 4 — link / notes / unlink for before/after room flips.
 * Application layer never rewrites layout contents, seating, setup membership,
 * preference, approval, operational, or sharing as a side effect of flip ops.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  canEditFloorPlans,
  FLOOR_PLAN_EDIT_DENIED,
} from "@/lib/floor-plans/authorize";
import {
  mapFlipRow,
  sanitizeTransitionNotes,
  spaceIdsMismatch,
  type EventFloorPlanFlip,
} from "@/lib/floor-plans/flips";
import * as repo from "@/lib/floor-plans/repository";
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

async function enrichFlip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  flip: ReturnType<typeof mapFlipRow>,
): Promise<EventFloorPlanFlip> {
  const before = await repo.getFloorPlan(supabase, venueId, flip.beforeFloorPlanId);
  const after = await repo.getFloorPlan(supabase, venueId, flip.afterFloorPlanId);
  return {
    ...flip,
    beforeName: before?.name,
    afterName: after?.name,
    beforeSpaceId: before?.spaceId ?? null,
    afterSpaceId: after?.spaceId ?? null,
  };
}

export async function getEventFloorPlanFlip(
  eventId: string,
): Promise<EventFloorPlanFlip | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const row = await repo.getEventFloorPlanFlip(supabase, venue.id, eventId);
  if (!row) return null;
  return enrichFlip(supabase, venue.id, mapFlipRow(row));
}

export async function linkEventFloorPlanFlip(
  eventId: string,
  beforeFloorPlanId: string,
  afterFloorPlanId: string,
  transitionNotes?: string | null,
): Promise<
  FloorPlanActionResult & {
    flip?: EventFloorPlanFlip;
    spaceMismatchWarning?: boolean;
  }
> {
  if (!beforeFloorPlanId || !afterFloorPlanId) {
    return { ok: false, message: "Choose both a before layout and an after layout." };
  }
  if (beforeFloorPlanId === afterFloorPlanId) {
    return { ok: false, message: "Before and after must be two different layouts." };
  }

  const notes = sanitizeTransitionNotes(transitionNotes);

  const result = await withVenueEditor(async (supabase, venueId) => {
    const before = await repo.getFloorPlan(supabase, venueId, beforeFloorPlanId);
    const after = await repo.getFloorPlan(supabase, venueId, afterFloorPlanId);
    if (!before || before.eventId !== eventId) {
      return { ok: false as const, message: "Before layout was not found on this event." };
    }
    if (!after || after.eventId !== eventId) {
      return { ok: false as const, message: "After layout was not found on this event." };
    }

    const row = await repo.upsertEventFloorPlanFlip(supabase, {
      venueId,
      eventId,
      beforeFloorPlanId,
      afterFloorPlanId,
      transitionNotes: notes,
    });

    const flip = await enrichFlip(supabase, venueId, mapFlipRow(row));
    const spaceMismatchWarning = spaceIdsMismatch(before.spaceId, after.spaceId);
    return { ok: true as const, flip, spaceMismatchWarning };
  });

  return result as FloorPlanActionResult & {
    flip?: EventFloorPlanFlip;
    spaceMismatchWarning?: boolean;
  };
}

export async function updateEventFloorPlanFlipNotes(
  eventId: string,
  transitionNotes: string | null,
): Promise<FloorPlanActionResult & { flip?: EventFloorPlanFlip }> {
  const notes = sanitizeTransitionNotes(transitionNotes);
  const result = await withVenueEditor(async (supabase, venueId) => {
    const existing = await repo.getEventFloorPlanFlip(supabase, venueId, eventId);
    if (!existing) {
      return { ok: false as const, message: "No linked flip on this event yet." };
    }
    const row = await repo.updateEventFloorPlanFlipNotes(
      supabase,
      venueId,
      eventId,
      notes,
    );
    const flip = await enrichFlip(supabase, venueId, mapFlipRow(row));
    return { ok: true as const, flip };
  });
  return result as FloorPlanActionResult & { flip?: EventFloorPlanFlip };
}

/**
 * Unlink removes only the relationship + notes. Layouts, objects, seating,
 * setup membership, preference, approval, ops, and sharing are untouched.
 */
export async function unlinkEventFloorPlanFlip(
  eventId: string,
): Promise<FloorPlanActionResult> {
  return withVenueEditor(async (supabase, venueId) => {
    const existing = await repo.getEventFloorPlanFlip(supabase, venueId, eventId);
    if (!existing) {
      // Idempotent: already unlinked is success (safe retry).
      return { ok: true as const };
    }
    await repo.deleteEventFloorPlanFlip(supabase, venueId, eventId);
    return { ok: true as const };
  });
}
