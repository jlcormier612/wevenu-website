"use server";

import { revalidatePath } from "next/cache";

import { addFloorPlanStarterAgain } from "@/lib/floor-plan-templates/provision";
import type { FloorPlanStarterMasterKey } from "@/lib/floor-plan-templates/starters";

function revalidateLibrary(templateId?: string) {
  revalidatePath("/library/floor-plan-templates");
  revalidatePath("/library");
  if (templateId) revalidatePath(`/library/floor-plan-templates/${templateId}`);
}

export async function addFloorPlanStarterAgainAction(
  masterKey: FloorPlanStarterMasterKey,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  const result = await addFloorPlanStarterAgain(masterKey);
  if (result.ok) revalidateLibrary(result.templateId);
  return result;
}
