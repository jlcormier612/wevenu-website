"use server";

import { revalidatePath } from "next/cache";

import {
  generateFollowUpDraft,
  updateDraftStatus,
} from "@/lib/luv/drafts";
import type { LuvDraft } from "@/lib/luv/drafts";
import type { Lead } from "@/lib/leads/types";

export async function generateFollowUpDraftAction(
  lead: Lead,
): Promise<{ ok: true; draft: LuvDraft } | { ok: false; message: string }> {
  const result = await generateFollowUpDraft(lead);
  if (result.ok) revalidatePath(`/leads/${lead.id}`);
  return result;
}

export async function updateDraftStatusAction(
  draftId: string,
  leadId: string,
  status: "accepted" | "discarded",
): Promise<void> {
  await updateDraftStatus(draftId, status);
  revalidatePath(`/leads/${leadId}`);
}
