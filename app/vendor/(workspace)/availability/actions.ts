"use server";

import { revalidatePath } from "next/cache";

import {
  blockDate,
  blockDates,
  getVendorAvailability,
  unblockDate,
  unblockDates,
  updateAvailabilitySettings,
} from "@/lib/vendor-availability/service";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type { VendorActionResult, VendorAvailability } from "@/lib/vendors/types";

function revalidateAvailabilityViews() {
  revalidatePath("/vendor/availability");
  revalidatePath("/vendor/profile");
}

export async function blockDateAction(date: string, note?: string): Promise<VendorActionResult & { id?: string }> {
  return blockDate(date, note);
}

export async function unblockDateAction(id: string): Promise<VendorActionResult> {
  return unblockDate(id);
}

export async function blockDatesAction(dates: string[], note?: string): Promise<VendorActionResult & { ids?: Record<string, string> }> {
  return blockDates(dates, note);
}

export async function unblockDatesAction(dates: string[]): Promise<VendorActionResult> {
  return unblockDates(dates);
}

export async function updateAvailabilitySettingsAction(
  settings: { acceptingInquiries: boolean; availabilityNotes: string },
): Promise<VendorActionResult> {
  const result = await updateAvailabilitySettings(settings);
  if (result.ok) revalidateAvailabilityViews();
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
