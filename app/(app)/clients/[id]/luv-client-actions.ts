"use server";

import { revalidatePath } from "next/cache";

import { generateClientDraft, type ClientDraft, type ClientDraftType } from "@/lib/luv/client-drafts";
import { updateDraftStatus } from "@/lib/luv/drafts";

export async function generateClientDraftAction(
  clientId: string,
  draftType: ClientDraftType,
): Promise<{ ok: true; draft: ClientDraft } | { ok: false; message: string }> {
  const result = await generateClientDraft(clientId, draftType);
  if (result.ok) revalidatePath(`/clients/${clientId}`);
  return result;
}

export async function updateClientDraftStatusAction(
  draftId: string,
  clientId: string,
  status: "accepted" | "discarded",
): Promise<void> {
  await updateDraftStatus(draftId, status);
  revalidatePath(`/clients/${clientId}`);
}
