"use server";

import { revalidatePath } from "next/cache";

import { addTimelineStarterAgain } from "@/lib/timeline-templates/provision";
import type { TimelineStarterMasterKey } from "@/lib/timeline-templates/starters";

function revalidateLibrary(templateId?: string) {
  revalidatePath("/library/timeline-templates");
  revalidatePath("/library");
  if (templateId) revalidatePath(`/library/timeline-templates/${templateId}`);
}

export async function addTimelineStarterAgainAction(
  masterKey: TimelineStarterMasterKey,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  const result = await addTimelineStarterAgain(masterKey);
  if (result.ok) revalidateLibrary(result.templateId);
  return result;
}
