"use server";

import { revalidatePath } from "next/cache";

import {
  deleteDraft,
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
  status: "accepted",
): Promise<void> {
  await updateDraftStatus(draftId, status);
  revalidatePath(`/leads/${leadId}`);
}

/** Discard = permanent delete. Does not archive. */
export async function deleteDraftAction(
  draftId: string,
  leadId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await deleteDraft(draftId);
  if (result.ok) revalidatePath(`/leads/${leadId}`);
  return result;
}
