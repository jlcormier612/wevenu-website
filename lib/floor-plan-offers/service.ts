/**
 * Event Floor Plan Offers service. Server-only. Phase 2.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  canEditFloorPlans,
  FLOOR_PLAN_EDIT_DENIED,
} from "@/lib/floor-plans/authorize";
import * as repo from "@/lib/floor-plan-offers/repository";
import type {
  EventFloorPlanOfferWithTemplate,
  UpsertEventFloorPlanOfferInput,
} from "@/lib/floor-plan-offers/types";
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

export async function getEventFloorPlanOffers(eventId: string): Promise<EventFloorPlanOfferWithTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.listOffersForEvent(await createClient(), venue.id, eventId);
}

export async function upsertEventFloorPlanOffer(
  eventId: string,
  input: UpsertEventFloorPlanOfferInput,
): Promise<{ ok: true; offerId: string } | FloorPlanActionResult> {
  if (!input.templateId) return { ok: false, message: "Template is required." };
  const result = await withVenueEditor(async (supabase, venueId) => {
    const offerId = await repo.upsertOffer(supabase, venueId, eventId, input);
    return { ok: true as const, offerId };
  });
  return result as { ok: true; offerId: string } | FloorPlanActionResult;
}

/**
 * Overview setup — recover event floor-plan offers from configured template ids.
 * Idempotent: if any offer rows already exist for the event, returns without
 * creating more. Does not create operational floor_plans rows, share, or release.
 */
export async function ensureEventFloorPlanOffers(
  eventId: string,
  templateIds: string[],
  preferredId: string | null = null,
): Promise<{ ok: true; created: number } | FloorPlanActionResult> {
  const selected = new Set(templateIds.filter(Boolean));
  if (preferredId) selected.add(preferredId);
  if (selected.size === 0) {
    return { ok: false, message: "No floor-plan layouts are configured to recover." };
  }
  const result = await withVenueEditor(async (supabase, venueId) => {
    const existing = await repo.listOffersForEvent(supabase, venueId, eventId);
    if (existing.length > 0) {
      return { ok: true as const, created: 0 };
    }
    const ordered = [
      ...(preferredId && selected.has(preferredId) ? [preferredId] : []),
      ...[...selected].filter((id) => id !== preferredId),
    ];
    for (let i = 0; i < ordered.length; i += 1) {
      await repo.upsertOffer(supabase, venueId, eventId, {
        templateId: ordered[i]!,
        sortOrder: i,
        isOffered: true,
      });
    }
    return { ok: true as const, created: ordered.length };
  });
  return result as { ok: true; created: number } | FloorPlanActionResult;
}

export async function updateEventFloorPlanOffer(
  offerId: string,
  patch: {
    sortOrder?: number;
    isOffered?: boolean;
    coupleLabel?: string | null;
    coupleBlurb?: string | null;
  },
): Promise<FloorPlanActionResult> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    await repo.updateOffer(supabase, venueId, offerId, patch);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

/** Withdraw from chooser — does not clear selection or delete event clone. */
export async function withdrawEventFloorPlanOffer(offerId: string): Promise<FloorPlanActionResult> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    await repo.withdrawOffer(supabase, venueId, offerId);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function deleteEventFloorPlanOffer(offerId: string): Promise<FloorPlanActionResult> {
  const result = await withVenueEditor(async (supabase, venueId) => {
    await repo.deleteOffer(supabase, venueId, offerId);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}
