"use server";

import { revalidatePath } from "next/cache";

import { updateVenueEmailSignature } from "@/lib/venue/service";

export async function updateEmailSignatureAction(
  signature: string,
): Promise<{ ok: boolean; message?: string }> {
  const result = await updateVenueEmailSignature(signature);
  if (result.ok) {
    revalidatePath("/settings/communications");
    revalidatePath("/settings/business");
  }
  return result;
}
