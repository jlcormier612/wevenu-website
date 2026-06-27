"use server";

import { revalidatePath } from "next/cache";

import { addPackageItem, createPackage, deletePackage_, removePackageItem, updatePackage_ } from "@/lib/packages/service";
import type { CreatePackageResult, PackageActionResult, PackageInput, PackageItemInput, PackageItem } from "@/lib/packages/types";

export async function createPackageAction(input: PackageInput): Promise<CreatePackageResult> {
  const result = await createPackage(input);
  if (result.ok) revalidatePath("/packages");
  return result;
}

export async function updatePackageAction(id: string, input: PackageInput): Promise<PackageActionResult> {
  const result = await updatePackage_(id, input);
  if (result.ok) { revalidatePath("/packages"); revalidatePath(`/packages/${id}`); }
  return result;
}

export async function deletePackageAction(id: string): Promise<PackageActionResult> {
  const result = await deletePackage_(id);
  if (result.ok) revalidatePath("/packages");
  return result;
}

export async function addPackageItemAction(packageId: string, input: PackageItemInput): Promise<{ ok: true; item: PackageItem } | PackageActionResult> {
  const result = await addPackageItem(packageId, input);
  if (result.ok) revalidatePath(`/packages/${packageId}`);
  return result;
}

export async function removePackageItemAction(packageId: string, itemId: string): Promise<PackageActionResult> {
  const result = await removePackageItem(itemId);
  if (result.ok) revalidatePath(`/packages/${packageId}`);
  return result;
}
