"use server";

import { revalidatePath } from "next/cache";

import {
  updateVenueEmailFooterContactPrefs,
  updateVenueEmailSignature,
} from "@/lib/venue/service";

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

export async function updateEmailFooterContactPrefsAction(input: {
  signature: string;
  showSignature: boolean;
  showEmail: boolean;
  showPhone: boolean;
}): Promise<{ ok: boolean; message?: string }> {
  const result = await updateVenueEmailFooterContactPrefs({
    signature: input.signature,
    showSignature: input.showSignature,
    showEmail: input.showEmail,
    showPhone: input.showPhone,
  });
  if (result.ok) {
    revalidatePath("/settings/communications");
    revalidatePath("/settings/business");
  }
  return result;
}
