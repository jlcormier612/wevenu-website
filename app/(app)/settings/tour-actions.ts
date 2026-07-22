"use server";

import { revalidatePath } from "next/cache";
import {
  addTourAvailabilityException,
  removeTourAvailabilityException,
  replaceTourAvailabilityWindows,
  updateTourSettings,
} from "@/lib/tours/service";
import type { TourAvailabilityExceptionInput, TourAvailabilityWindowInput, TourSettings } from "@/lib/tours/types";

export async function updateTourSettingsAction(
  patch: Partial<Omit<TourSettings, "tourEmbedKey">>,
): Promise<{ ok: boolean }> {
  const result = await updateTourSettings(patch);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function replaceTourAvailabilityWindowsAction(
  windows: TourAvailabilityWindowInput[],
): Promise<{ ok: boolean }> {
  const result = await replaceTourAvailabilityWindows(windows);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function addTourAvailabilityExceptionAction(
  input: TourAvailabilityExceptionInput,
): Promise<{ ok: boolean }> {
  const result = await addTourAvailabilityException(input);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function removeTourAvailabilityExceptionAction(id: string): Promise<{ ok: boolean }> {
  const result = await removeTourAvailabilityException(id);
  if (result.ok) revalidatePath("/settings");
  return result;
}
