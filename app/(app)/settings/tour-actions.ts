"use server";

import { revalidatePath } from "next/cache";
import {
  addTourAvailabilityException,
  getCoordinatorTourSlots,
  removeTourAvailabilityException,
  replaceTourAvailabilityWindows,
  updateTourSettings,
} from "@/lib/tours/service";
import type { TourAvailabilityExceptionInput, TourAvailabilityWindowInput, TourSettings, TourSlot } from "@/lib/tours/types";

function revalidateTourAvailabilitySurfaces() {
  revalidatePath("/settings/leads");
  revalidatePath("/setup-hub/lead-capture");
  revalidatePath("/setup-hub");
}

export async function updateTourSettingsAction(
  patch: Partial<Omit<TourSettings, "tourEmbedKey">>,
): Promise<{ ok: boolean }> {
  const result = await updateTourSettings(patch);
  if (result.ok) revalidateTourAvailabilitySurfaces();
  return result;
}

export async function replaceTourAvailabilityWindowsAction(
  windows: TourAvailabilityWindowInput[],
): Promise<{ ok: boolean }> {
  const result = await replaceTourAvailabilityWindows(windows);
  if (result.ok) revalidateTourAvailabilitySurfaces();
  return result;
}

export async function addTourAvailabilityExceptionAction(
  input: TourAvailabilityExceptionInput,
): Promise<{ ok: boolean }> {
  const result = await addTourAvailabilityException(input);
  if (result.ok) revalidateTourAvailabilitySurfaces();
  return result;
}

export async function removeTourAvailabilityExceptionAction(id: string): Promise<{ ok: boolean }> {
  const result = await removeTourAvailabilityException(id);
  if (result.ok) revalidateTourAvailabilitySurfaces();
  return result;
}

/** Settings/Setup Hub preview — same slot engine as coordinator scheduling, from saved tour availability. */
export async function getTourSlotPreviewAction(startDate: string, endDate: string): Promise<TourSlot[]> {
  return getCoordinatorTourSlots(startDate, endDate);
}
