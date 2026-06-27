/**
 * Floor Plans application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/floor-plans/repository";
import type {
  AddObjectInput,
  CreateFloorPlanResult,
  FloorPlan,
  FloorPlanActionResult,
  FloorPlanWithObjects,
  UpdateObjectInput,
} from "@/lib/floor-plans/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | FloorPlanActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getFloorPlanByEvent(eventId: string): Promise<FloorPlanWithObjects | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getFloorPlanByEvent(await createClient(), venue.id, eventId);
}

export async function getAllFloorPlans(): Promise<FloorPlan[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getAllFloorPlans(await createClient(), venue.id);
}

export async function createFloorPlan(eventId: string): Promise<CreateFloorPlanResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const floorPlanId = await repo.createFloorPlan(supabase, venueId, eventId);
    return { ok: true, floorPlanId } as CreateFloorPlanResult;
  });
  return result as CreateFloorPlanResult;
}

export async function updateBackground(
  planId: string, url: string | null, opacity: number,
): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateFloorPlanBackground(supabase, venueId, planId, url, opacity);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function updateNotes(planId: string, notes: string): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateFloorPlanNotes(supabase, venueId, planId, notes);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function addObject(
  planId: string, input: AddObjectInput,
): Promise<{ ok: true; object: import("@/lib/floor-plans/types").FloorPlanObject } | FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const object = await repo.insertObject(supabase, venueId, planId, input);
    return { ok: true, object };
  });
  return result as { ok: true; object: import("@/lib/floor-plans/types").FloorPlanObject } | FloorPlanActionResult;
}

export async function updateObject_(
  objId: string, input: UpdateObjectInput,
): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateObject(supabase, venueId, objId, input);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function deleteObject_(objId: string): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteObject(supabase, venueId, objId);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function clearFloorPlan(planId: string): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.clearAllObjects(supabase, venueId, planId);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}
