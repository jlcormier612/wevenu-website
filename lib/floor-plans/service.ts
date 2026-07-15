/**
 * Floor Plans application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/floor-plans/repository";
import * as templatesRepo from "@/lib/floor-plan-templates/repository";
import type {
  AddObjectInput,
  CreateFloorPlanResult,
  FloorPlan,
  FloorPlanActionResult,
  FloorPlanSectionReconciliation,
  FloorPlanWithObjects,
  ReorderDirection,
  UpdateObjectInput,
  UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { triggerAutoComplete } from "@/lib/playbooks/service";

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

/** The Booking Floor Plan Workspace's card grid — every floor plan this booking owns. */
export async function getFloorPlansByEvent(eventId: string): Promise<FloorPlan[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getFloorPlansByEvent(await createClient(), venue.id, eventId);
}

export async function getFloorPlan(id: string): Promise<FloorPlanWithObjects | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getFloorPlan(await createClient(), venue.id, id);
}

export async function getAllFloorPlans(): Promise<FloorPlan[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getAllFloorPlans(await createClient(), venue.id);
}

/** "Blank Floor Plan" — a booking may hold many; each gets its own name and optional venue space. */
export async function createFloorPlan(eventId: string, name = "Floor Plan", spaceId: string | null = null): Promise<CreateFloorPlanResult> {
  if (!name.trim()) return { ok: false, message: "Floor plan name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const floorPlanId = await repo.createFloorPlan(supabase, venueId, eventId, name.trim(), spaceId);
    await triggerAutoComplete(supabase, venueId, eventId, "floor_plan_created", "floor_plan", floorPlanId);
    return { ok: true, floorPlanId } as CreateFloorPlanResult;
  });
  return result as CreateFloorPlanResult;
}

/**
 * "Apply Template" (Booking Floor Plan Workspace task): copies a template's
 * objects and background into a brand-new, independently-editable booking
 * floor plan under its own name/space. A copy, not a link — the booking
 * owns it from this point on, and neither side is ever touched by edits to
 * the other. A booking may apply the same template more than once.
 */
export async function applyTemplate(eventId: string, templateId: string, name: string, spaceId: string | null): Promise<CreateFloorPlanResult> {
  if (!name.trim()) return { ok: false, message: "Floor plan name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const template = await templatesRepo.getTemplate(supabase, venueId, templateId);
    if (!template) return { ok: false, message: "Template not found." } as CreateFloorPlanResult;
    const objects = await templatesRepo.getObjects(supabase, venueId, templateId);

    const floorPlanId = await repo.createFloorPlan(supabase, venueId, eventId, name.trim(), spaceId);
    if (template.backgroundImageUrl) {
      await repo.updateFloorPlanBackground(supabase, venueId, floorPlanId, template.backgroundImageUrl, template.backgroundImageOpacity);
    }
    await repo.updateFloorPlanRoomSettings(supabase, venueId, floorPlanId, {
      roomWidthFt: template.roomWidthFt, roomDepthFt: template.roomDepthFt, measurementUnit: template.measurementUnit,
    });
    await repo.insertObjects(supabase, venueId, floorPlanId, objects);
    await triggerAutoComplete(supabase, venueId, eventId, "floor_plan_created", "floor_plan", floorPlanId);

    return { ok: true, floorPlanId } as CreateFloorPlanResult;
  });
  return result as CreateFloorPlanResult;
}

/** "Duplicate Existing Floor Plan" — clone another floor plan already on this booking. Never touches the source. */
export async function duplicateFloorPlan(eventId: string, sourceFloorPlanId: string, name: string, spaceId: string | null): Promise<CreateFloorPlanResult> {
  if (!name.trim()) return { ok: false, message: "Floor plan name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const floorPlanId = await repo.duplicateFloorPlanInto(supabase, venueId, eventId, sourceFloorPlanId, name, spaceId);
    await triggerAutoComplete(supabase, venueId, eventId, "floor_plan_created", "floor_plan", floorPlanId);
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

export async function setBackgroundLocked(planId: string, locked: boolean): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setFloorPlanBackgroundLocked(supabase, venueId, planId, locked);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function setClientAccess(planId: string, clientAccess: FloorPlan["clientAccess"]): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setFloorPlanClientAccess(supabase, venueId, planId, clientAccess);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

/** Phase 4 — the print-ready checkpoint. Never gates editing; reversible. */
export async function setFinalized(planId: string, finalized: boolean): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setFloorPlanFinalized(supabase, venueId, planId, finalized);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

/** Phase 4 — fact-based comparison only. See repo.getFloorPlanReconciliation. */
export async function getFloorPlanReconciliation(planId: string): Promise<FloorPlanSectionReconciliation[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getFloorPlanReconciliation(await createClient(), venue.id, planId);
}

export async function updateRoomSettings(planId: string, input: UpdateRoomSettingsInput): Promise<FloorPlanActionResult> {
  if (input.roomWidthFt <= 0 || input.roomDepthFt <= 0) return { ok: false, message: "Room dimensions must be greater than zero." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateFloorPlanRoomSettings(supabase, venueId, planId, input);
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function reorderObject(planId: string, objId: string, direction: ReorderDirection): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.reorderObject(supabase, venueId, planId, objId, direction);
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

export async function renameFloorPlan(planId: string, name: string): Promise<FloorPlanActionResult> {
  if (!name.trim()) return { ok: false, message: "Name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.renameFloorPlan(supabase, venueId, planId, name.trim());
    return { ok: true } as FloorPlanActionResult;
  });
  return result as FloorPlanActionResult;
}

export async function deleteFloorPlan(planId: string): Promise<FloorPlanActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteFloorPlan(supabase, venueId, planId);
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
