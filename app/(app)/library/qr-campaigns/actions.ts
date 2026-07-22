"use server";

import { revalidatePath } from "next/cache";
import { archiveQrCampaign, createQrCampaign, reactivateQrCampaign } from "@/lib/qr-campaigns/service";
import type { QrCampaignActionResult, QrCampaignInput } from "@/lib/qr-campaigns/types";

export async function createQrCampaignAction(input: QrCampaignInput): Promise<QrCampaignActionResult> {
  const result = await createQrCampaign(input);
  if (result.ok) revalidatePath("/library/qr-campaigns");
  return result;
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
