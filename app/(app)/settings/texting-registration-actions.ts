"use server";

import { revalidatePath } from "next/cache";

import {
  getTextingSetupBundle,
  saveTextingRegistrationDraft,
  startTextingSetup,
  submitTextingRegistration,
} from "@/lib/texting-registration/service";
import type { TextingRegistrationInput } from "@/lib/texting-registration/types";

function revalidateTextingPaths() {
  revalidatePath("/settings/communications");
  revalidatePath("/messaging/health");
  revalidatePath("/messaging");
}

export async function getTextingSetupBundleAction() {
  return getTextingSetupBundle();
}

export async function startTextingSetupAction() {
  const result = await startTextingSetup();
  if (result.ok) revalidateTextingPaths();
  return result;
}

export async function saveTextingRegistrationDraftAction(
  input: TextingRegistrationInput,
) {
  const result = await saveTextingRegistrationDraft(input);
  if (result.ok) revalidateTextingPaths();
  return result;
}

export async function submitTextingRegistrationAction(
  input: TextingRegistrationInput,
) {
  const result = await submitTextingRegistration(input);
  if (result.ok) revalidateTextingPaths();
  return result;
}
