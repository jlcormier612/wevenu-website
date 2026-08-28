"use server";

import { revalidatePath } from "next/cache";

import {
  replaceInquiryFormQuestions,
  updateInquiryFormSettings,
} from "@/lib/inquiry-form/service";
import type { InquiryFormFieldsConfig, InquiryFormQuestion, InquiryEventDateMode } from "@/lib/inquiry-form/types";

function revalidateInquiryFormSurfaces() {
  revalidatePath("/settings/leads");
  revalidatePath("/setup-hub/lead-capture");
  revalidatePath("/setup-hub");
}

export async function updateInquiryFormSettingsAction(patch: {
  inquiryEventDateMode?: InquiryEventDateMode;
  inquiryFormFields?: InquiryFormFieldsConfig;
  acceptedEventTypes?: string[];
}): Promise<{ ok: boolean }> {
  const result = await updateInquiryFormSettings(patch);
  if (result.ok) revalidateInquiryFormSurfaces();
  return result;
}

export async function replaceInquiryFormQuestionsAction(
  questions: Omit<InquiryFormQuestion, "sortOrder">[],
): Promise<{ ok: boolean }> {
  const result = await replaceInquiryFormQuestions(questions);
  if (result.ok) revalidateInquiryFormSurfaces();
  return result;
}
