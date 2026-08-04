"use server";

import { revalidatePath } from "next/cache";

import {
  blockDate,
  getVendorAvailability,
  unblockDate,
  updateAvailabilitySettings,
} from "@/lib/vendor-availability/service";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type { VendorActionResult, VendorAvailability } from "@/lib/vendors/types";

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

/** Load (and reconcile) one calendar month when the vendor navigates. month is 0-indexed. */
export async function loadAvailabilityMonthAction(
  year: number,
  month: number,
): Promise<VendorAvailability[]> {
  const vendorUser = await getVendorUser();
  if (!vendorUser) return [];
  return getVendorAvailability(vendorUser.vendorId, year, month + 1);
}
