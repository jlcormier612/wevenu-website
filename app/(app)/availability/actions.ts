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
  releaseHold,
  saveCapacityRules,
  updateSpace_,
} from "@/lib/availability/service";
import type {
  AvailabilityActionResult,
  AvailabilityStatus,
  CalendarBlockInput,
  CreateHoldResult,
  CreateSpaceResult,
  DateHoldInput,
  SpaceInput,
} from "@/lib/availability/types";

export async function createSpaceAction(input: SpaceInput): Promise<CreateSpaceResult> {
  const result = await createSpace(input);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function updateSpaceAction(spaceId: string, input: SpaceInput): Promise<AvailabilityActionResult> {
  const result = await updateSpace_(spaceId, input);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function deleteSpaceAction(spaceId: string): Promise<AvailabilityActionResult> {
  const result = await deleteSpace_(spaceId);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function saveCapacityRulesAction(input: { maxSimultaneousEvents: number; maxSimultaneousTours: number; minTurnaroundHours: number }): Promise<AvailabilityActionResult> {
  const result = await saveCapacityRules(input);
  if (result.ok) revalidatePath("/settings");
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

export async function deleteBlockAction(blockId: string): Promise<AvailabilityActionResult> {
  const result = await deleteBlock_(blockId);
  if (result.ok) revalidatePath("/calendar");
  return result;
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
