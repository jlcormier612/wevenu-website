"use server";

import { revalidatePath } from "next/cache";

import {
  addObject,
  applyTemplate,
  clearFloorPlan,
  createFloorPlan,
  deleteFloorPlan,
  deleteObject_,
  duplicateFloorPlan,
  getFloorPlanReconciliation,
  renameFloorPlan,
  reorderObject,
  setBackgroundLocked,
  setClientAccess,
  setFinalized,
  updateBackground,
  updateNotes,
  updateObject_,
  updateRoomSettings,
} from "@/lib/floor-plans/service";
import type {
  AddObjectInput,
  CreateFloorPlanResult,
  FloorPlan,
  FloorPlanActionResult,
  FloorPlanObject,
  FloorPlanSectionReconciliation,
  ReorderDirection,
  UpdateObjectInput,
  UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

// The workspace's card grid lives on the event's floor-plans index — revalidate
// it whenever a new floor plan is created so the new card shows up. The
// day-of dashboard also lists floor plans (Quick Floor Plans) and needs the
// same treatment whenever a plan's name or existence changes.
function revalidateWorkspace(eventId: string) {
  revalidatePath(`/events/${eventId}/floor-plans`);
  revalidatePath(`/events/${eventId}/today`);
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

export async function renameFloorPlanAction(
  planId: string, eventId: string, name: string,
): Promise<FloorPlanActionResult> {
  const result = await renameFloorPlan(planId, name);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function deleteFloorPlanAction(
  planId: string, eventId: string,
): Promise<FloorPlanActionResult> {
  const result = await deleteFloorPlan(planId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
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

/** Seating Experience — Phase 1: share (or hide) this Floor Plan with the couple. */
export async function setClientAccessAction(
  planId: string, eventId: string, clientAccess: FloorPlan["clientAccess"],
): Promise<FloorPlanActionResult> {
  const result = await setClientAccess(planId, clientAccess);
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

/**
 * Phase 4 — the coordinator's own "print-ready" checkpoint. Reversible
 * (Reopen clears it), and never gates placement editing before, during, or
 * after — a coordinator can keep editing a Final floor plan freely.
 */
export async function setFloorPlanFinalizedAction(
  planId: string, eventId: string, finalized: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setFinalized(planId, finalized);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Phase 4 — read-only, fact-based comparison. Never writes to either side. */
export async function getFloorPlanReconciliationAction(
  planId: string,
): Promise<FloorPlanSectionReconciliation[]> {
  return getFloorPlanReconciliation(planId);
}
