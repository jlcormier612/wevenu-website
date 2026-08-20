"use server";

import { revalidatePath } from "next/cache";
import {
  connectFacebookAccount,
  disconnectFacebookAccount,
  listFacebookLeadForms,
  listFacebookPages,
  selectFacebookLeadForms,
  selectFacebookPage,
  setFacebookFormEnabled,
} from "@/lib/facebook/service";
import type { FacebookActionResult } from "@/lib/facebook/types";

export async function connectFacebookAction(input: { userAccessToken: string; expiresIn: number }): Promise<FacebookActionResult> {
  const result = await connectFacebookAccount(input);
  revalidatePath("/settings");
  return result;
}

export async function listFacebookPagesAction() {
  return listFacebookPages();
}

export async function selectFacebookPageAction(input: { pageId: string }): Promise<FacebookActionResult> {
  const result = await selectFacebookPage(input);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function listFacebookLeadFormsAction() {
  return listFacebookLeadForms();
}

export async function selectFacebookLeadFormsAction(forms: { formId: string; formName: string }[]): Promise<FacebookActionResult> {
  const result = await selectFacebookLeadForms(forms);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function setFacebookFormEnabledAction(formId: string, enabled: boolean): Promise<FacebookActionResult> {
  const result = await setFacebookFormEnabled(formId, enabled);
  if (result.ok) revalidatePath("/settings");
  return result;
}

export async function disconnectFacebookAction(): Promise<FacebookActionResult> {
  const result = await disconnectFacebookAccount();
  revalidatePath("/settings");
  return result;
}
