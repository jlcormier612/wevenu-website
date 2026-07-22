"use server";

import { revalidatePath } from "next/cache";

import { completeTaskInWorkspace } from "@/lib/white-glove/complete-task";

export async function completeTaskAction(
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await completeTaskInWorkspace(taskId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/tasks");
  revalidatePath("/onboarding");
  revalidatePath("/relationships");
  revalidatePath(`/relationships/${result.relationshipId}`);
  return { ok: true };
}
