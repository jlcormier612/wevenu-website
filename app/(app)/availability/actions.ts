"use server";

import { revalidatePath } from "next/cache";

import {
  checkAvailability,
  convertHold,
  createBlock,
  createHold,
  createSpace,
  deleteBlock_,
  deleteHold_,
  deleteSpace_,
  getBlock,
  markBlockConverted_,
  releaseHold,
  saveCapacityRules,
  updateBlock_,
  updateSpace_,
} from "@/lib/availability/service";
import type {
  AvailabilityActionResult,
  AvailabilityStatus,
  CalendarBlock,
  CalendarBlockInput,
  CreateHoldResult,
  CreateSpaceResult,
  DateHoldInput,
  SpaceInput,
} from "@/lib/availability/types";
import { getScheduleRelationOption, searchScheduleRelationOptions } from "@/lib/calendar/service";
import type { ScheduleRelationOption } from "@/lib/calendar/types";

export async function createSpaceAction(input: SpaceInput): Promise<CreateSpaceResult> {
  const result = await createSpace(input);
  if (result.ok) revalidatePath("/settings/availability");
  return result;
}

export async function updateSpaceAction(spaceId: string, input: SpaceInput): Promise<AvailabilityActionResult> {
  const result = await updateSpace_(spaceId, input);
  if (result.ok) revalidatePath("/settings/availability");
  return result;
}

export async function deleteSpaceAction(spaceId: string): Promise<AvailabilityActionResult> {
  const result = await deleteSpace_(spaceId);
  if (result.ok) revalidatePath("/settings/availability");
  return result;
}

export async function saveCapacityRulesAction(input: { maxSimultaneousEvents: number; maxSimultaneousTours: number; minTurnaroundHours: number }): Promise<AvailabilityActionResult> {
  const result = await saveCapacityRules(input);
  if (result.ok) revalidatePath("/settings/availability");
  return result;
}

export async function createHoldAction(input: DateHoldInput): Promise<CreateHoldResult> {
  const result = await createHold(input);
  if (result.ok) { revalidatePath("/calendar"); revalidatePath("/leads", "layout"); }
  return result;
}

export async function releaseHoldAction(holdId: string): Promise<AvailabilityActionResult> {
  const result = await releaseHold(holdId);
  if (result.ok) { revalidatePath("/calendar"); revalidatePath("/leads", "layout"); }
  return result;
}

export async function convertHoldAction(holdId: string): Promise<AvailabilityActionResult> {
  const result = await convertHold(holdId);
  if (result.ok) revalidatePath("/leads", "layout");
  return result;
}

export async function deleteHoldAction(holdId: string): Promise<AvailabilityActionResult> {
  const result = await deleteHold_(holdId);
  if (result.ok) revalidatePath("/calendar");
  return result;
}

export async function createBlockAction(input: CalendarBlockInput): Promise<{ ok: true; blockId: string } | AvailabilityActionResult> {
  const result = await createBlock(input);
  if (result.ok) revalidatePath("/calendar");
  return result;
}

export async function updateBlockAction(blockId: string, input: CalendarBlockInput): Promise<AvailabilityActionResult> {
  const result = await updateBlock_(blockId, input);
  if (result.ok) revalidatePath("/calendar");
  return result;
}

/** Loads one schedule item so the Calendar edit form can open pre-filled. Venue-scoped by getBlock itself. */
export async function getBlockAction(blockId: string): Promise<CalendarBlock | null> {
  return getBlock(blockId);
}

export async function deleteBlockAction(blockId: string): Promise<AvailabilityActionResult> {
  const result = await deleteBlock_(blockId);
  if (result.ok) revalidatePath("/calendar");
  return result;
}

export async function markScheduleItemConvertedAction(blockId: string, leadId: string): Promise<AvailabilityActionResult> {
  const result = await markBlockConverted_(blockId, leadId);
  if (result.ok) revalidatePath("/calendar");
  return result;
}

/** Calendar "Related to" search — a venue with hundreds of leads/clients gets a query, never the whole list. */
export async function searchScheduleRelationOptionsAction(query: string): Promise<ScheduleRelationOption[]> {
  return searchScheduleRelationOptions(query);
}

/** Resolves one Lead/Client so an existing "Related to" link can pre-populate with full context, no re-search. */
export async function getScheduleRelationOptionAction(kind: "lead" | "client", id: string): Promise<ScheduleRelationOption | null> {
  return getScheduleRelationOption(kind, id);
}

export async function checkAvailabilityAction(opts: {
  date: string;
  startTime?: string;
  endTime?: string;
  spaceId?: string;
  type: "event" | "tour";
  excludeId?: string;
}): Promise<AvailabilityStatus> {
  return checkAvailability(opts);
}
