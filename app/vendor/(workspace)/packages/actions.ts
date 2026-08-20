"use server";

import { revalidatePath } from "next/cache";

import {
  createVendorPackage,
  deleteVendorPackage,
  toggleVendorPackage,
  updateVendorPackage,
} from "@/lib/vendor-packages/service";
import type { VendorActionResult, VendorPackageInput } from "@/lib/vendors/types";

export async function createVendorPackageAction(input: VendorPackageInput): Promise<VendorActionResult & { packageId?: string }> {
  const result = await createVendorPackage(input);
  if (result.ok) revalidatePath("/vendor/packages");
  return result;
}

export async function updateVendorPackageAction(id: string, input: VendorPackageInput): Promise<VendorActionResult> {
  const result = await updateVendorPackage(id, input);
  if (result.ok) revalidatePath("/vendor/packages");
  return result;
}

export async function deleteVendorPackageAction(id: string): Promise<VendorActionResult> {
  const result = await deleteVendorPackage(id);
  if (result.ok) revalidatePath("/vendor/packages");
  return result;
}

export async function toggleVendorPackageAction(id: string, isActive: boolean): Promise<VendorActionResult> {
  const result = await toggleVendorPackage(id, isActive);
  if (result.ok) revalidatePath("/vendor/packages");
  return result;
}
