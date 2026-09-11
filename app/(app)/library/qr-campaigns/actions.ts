"use server";

import { revalidatePath } from "next/cache";
import { addQrStarterAgain, ensureQrStartersForCurrentVenue } from "@/lib/qr-campaigns/provision";
import { getQrStarterMaster, type QrStarterMasterKey } from "@/lib/qr-campaigns/starters";
import { archiveQrCampaign, createQrCampaign, reactivateQrCampaign } from "@/lib/qr-campaigns/service";
import type { QrCampaignActionResult, QrCampaignInput } from "@/lib/qr-campaigns/types";

export async function createQrCampaignAction(input: QrCampaignInput): Promise<QrCampaignActionResult> {
  const result = await createQrCampaign(input);
  if (result.ok) revalidatePath("/library/qr-campaigns");
  return result;
}

export async function createQrFromStarterAction(
  masterKey: QrStarterMasterKey,
): Promise<QrCampaignActionResult> {
  const master = getQrStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const provisioned = await ensureQrStartersForCurrentVenue();
  if (!provisioned.ok) return { ok: false, message: provisioned.message };
  if (provisioned.created.includes(masterKey)) {
    revalidatePath("/library/qr-campaigns");
    return { ok: true };
  }
  const again = await addQrStarterAgain(masterKey);
  if (!again.ok) return { ok: false, message: again.message };
  revalidatePath("/library/qr-campaigns");
  return { ok: true, id: again.campaignId };
}

export async function addQrStarterAgainAction(
  masterKey: QrStarterMasterKey,
): Promise<QrCampaignActionResult> {
  const result = await addQrStarterAgain(masterKey);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/library/qr-campaigns");
  return { ok: true, id: result.campaignId };
}

export async function archiveQrCampaignAction(id: string): Promise<QrCampaignActionResult> {
  const result = await archiveQrCampaign(id);
  if (result.ok) revalidatePath("/library/qr-campaigns");
  return result;
}

export async function reactivateQrCampaignAction(id: string): Promise<QrCampaignActionResult> {
  const result = await reactivateQrCampaign(id);
  if (result.ok) revalidatePath("/library/qr-campaigns");
  return result;
}
