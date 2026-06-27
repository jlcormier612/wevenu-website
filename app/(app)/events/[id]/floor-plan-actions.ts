"use server";

import { revalidatePath } from "next/cache";

import {
  addObject,
  clearFloorPlan,
  createFloorPlan,
  deleteObject_,
  updateBackground,
  updateNotes,
  updateObject_,
} from "@/lib/floor-plans/service";
import type {
  AddObjectInput,
  CreateFloorPlanResult,
  FloorPlanActionResult,
  FloorPlanObject,
  UpdateObjectInput,
} from "@/lib/floor-plans/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

export async function createFloorPlanAction(eventId: string): Promise<CreateFloorPlanResult> {
  const result = await createFloorPlan(eventId);
  if (result.ok) revalidateEvent(eventId);
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
