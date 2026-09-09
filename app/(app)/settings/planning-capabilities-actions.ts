"use server";

import { revalidatePath } from "next/cache";

import type { VenuePlanningCapabilities } from "@/lib/playbooks/capabilities";
import { updateVenuePlanningCapabilities } from "@/lib/venue/service";

export async function savePlanningCapabilitiesAction(
  caps: VenuePlanningCapabilities,
): Promise<{ ok: boolean; message?: string }> {
  const result = await updateVenuePlanningCapabilities(caps);
  if (result.ok) {
    revalidatePath("/library/playbooks");
    revalidatePath("/settings");
    revalidatePath("/clients");
  }
  return result;
}
