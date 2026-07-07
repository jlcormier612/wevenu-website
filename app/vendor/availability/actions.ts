"use server";

import { revalidatePath } from "next/cache";

import {
  blockDate,
  unblockDate,
  updateAvailabilitySettings,
} from "@/lib/vendor-availability/service";
import type { VendorActionResult } from "@/lib/vendors/types";

export async function blockDateAction(date: string, note?: string): Promise<VendorActionResult & { id?: string }> {
  const result = await blockDate(date, note);
  if (result.ok) revalidatePath("/vendor/availability");
  return result;
}

export async function unblockDateAction(id: string): Promise<VendorActionResult> {
  const result = await unblockDate(id);
  if (result.ok) revalidatePath("/vendor/availability");
  return result;
}

export async function updateAvailabilitySettingsAction(
  settings: { acceptingInquiries: boolean; availabilityNotes: string },
): Promise<VendorActionResult> {
  const result = await updateAvailabilitySettings(settings);
  if (result.ok) revalidatePath("/vendor/availability");
  return result;
}
