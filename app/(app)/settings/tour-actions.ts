"use server";

import { revalidatePath } from "next/cache";
import { updateTourSettings } from "@/lib/tours/service";
import type { TourSettings } from "@/lib/tours/types";

export async function updateTourSettingsAction(
  patch: Partial<Omit<TourSettings, "tourEmbedKey">>,
): Promise<{ ok: boolean }> {
  const result = await updateTourSettings(patch);
  if (result.ok) revalidatePath("/settings");
  return result;
}
