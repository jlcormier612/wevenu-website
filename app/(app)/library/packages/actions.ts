"use server";

import { revalidatePath } from "next/cache";

import { addPackageStarterAgain } from "@/lib/packages/provision";
import type { PackageStarterMasterKey } from "@/lib/packages/starters";

function revalidateLibrary(packageId?: string) {
  revalidatePath("/library/packages");
  revalidatePath("/packages");
  revalidatePath("/library");
  if (packageId) revalidatePath(`/packages/${packageId}`);
}

export async function addPackageStarterAgainAction(
  masterKey: PackageStarterMasterKey,
): Promise<{ ok: true; packageId: string } | { ok: false; message: string }> {
  const result = await addPackageStarterAgain(masterKey);
  if (result.ok) revalidateLibrary(result.packageId);
  return result;
}
