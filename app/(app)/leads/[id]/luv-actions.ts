"use server";

import { revalidatePath } from "next/cache";

import {
  deleteDraft,
  generateFollowUpDraft,
  updateDraftStatus,
} from "@/lib/luv/drafts";
import type { LuvDraft } from "@/lib/luv/drafts";
import type { Lead } from "@/lib/leads/types";

function revalidateLuvDraftSurfaces(lead: { id: string; linkedClientId?: string | null }) {
  revalidatePath(`/leads/${lead.id}`);
  if (lead.linkedClientId) revalidatePath(`/clients/${lead.linkedClientId}`);
}

function revalidateLuvDraftSurfacesByIds(leadId: string, linkedClientId?: string | null) {
  revalidatePath(`/leads/${leadId}`);
  if (linkedClientId) revalidatePath(`/clients/${linkedClientId}`);
}

export async function generateFollowUpDraftAction(
  lead: Lead,
): Promise<{ ok: true; draft: LuvDraft } | { ok: false; message: string }> {
  const result = await generateFollowUpDraft(lead);
  if (result.ok) revalidateLuvDraftSurfaces(lead);
  return result;
}

export async function updateDraftStatusAction(
  draftId: string,
  leadId: string,
  status: "accepted",
  linkedClientId?: string | null,
): Promise<void> {
  await updateDraftStatus(draftId, status);
  revalidateLuvDraftSurfacesByIds(leadId, linkedClientId);
}

/** Discard = permanent delete. Does not archive. */
export async function deleteDraftAction(
  draftId: string,
  leadId: string,
  linkedClientId?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await deleteDraft(draftId);
  if (result.ok) revalidateLuvDraftSurfacesByIds(leadId, linkedClientId);
  return result;
}
