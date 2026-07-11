"use server";

import { revalidatePath } from "next/cache";

import {
  addObject,
  applyTemplate,
  clearFloorPlan,
  createFloorPlan,
  deleteObject_,
  duplicateFloorPlan,
  reorderObject,
  setBackgroundLocked,
  updateBackground,
  updateNotes,
  updateObject_,
  updateRoomSettings,
} from "@/lib/floor-plans/service";
import type {
  AddObjectInput,
  CreateFloorPlanResult,
  FloorPlanActionResult,
  FloorPlanObject,
  ReorderDirection,
  UpdateObjectInput,
  UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

// The workspace's card grid lives on the event's floor-plans index — revalidate
// it whenever a new floor plan is created so the new card shows up.
function revalidateWorkspace(eventId: string) {
  revalidatePath(`/events/${eventId}/floor-plans`);
}

export async function createFloorPlanAction(eventId: string, name?: string, spaceId?: string | null): Promise<CreateFloorPlanResult> {
  const result = await createFloorPlan(eventId, name, spaceId ?? null);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function applyTemplateAction(
  eventId: string, templateId: string, name: string, spaceId: string | null,
): Promise<CreateFloorPlanResult> {
  const result = await applyTemplate(eventId, templateId, name, spaceId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function duplicateFloorPlanAction(
  eventId: string, sourceFloorPlanId: string, name: string, spaceId: string | null,
): Promise<CreateFloorPlanResult> {
  const result = await duplicateFloorPlan(eventId, sourceFloorPlanId, name, spaceId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function updateBackgroundAction(
  planId: string, eventId: string, url: string | null, opacity: number,
): Promise<FloorPlanActionResult> {
  const result = await updateBackground(planId, url, opacity);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateNotesAction(
  planId: string, eventId: string, notes: string,
): Promise<FloorPlanActionResult> {
  const result = await updateNotes(planId, notes);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function addObjectAction(
  planId: string, eventId: string, input: AddObjectInput,
): Promise<{ ok: true; object: FloorPlanObject } | FloorPlanActionResult> {
  const result = await addObject(planId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateObjectAction(
  objId: string, input: UpdateObjectInput,
): Promise<FloorPlanActionResult> {
  return updateObject_(objId, input);
}

export async function deleteObjectAction(
  objId: string, eventId: string,
): Promise<FloorPlanActionResult> {
  const result = await deleteObject_(objId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function clearFloorPlanAction(
  planId: string, eventId: string,
): Promise<FloorPlanActionResult> {
  const result = await clearFloorPlan(planId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function setBackgroundLockedAction(
  planId: string, eventId: string, locked: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setBackgroundLocked(planId, locked);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateRoomSettingsAction(
  planId: string, eventId: string, input: UpdateRoomSettingsInput,
): Promise<FloorPlanActionResult> {
  const result = await updateRoomSettings(planId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reorderObjectAction(
  planId: string, objId: string, eventId: string, direction: ReorderDirection,
): Promise<FloorPlanActionResult> {
  const result = await reorderObject(planId, objId, direction);
  if (result.ok) revalidateEvent(eventId);
  return result;
}
