"use server";

import { revalidatePath } from "next/cache";

import {
  archivePublicForm,
  createPublicForm,
  deactivatePublicForm,
  publishPublicForm,
  replacePublicFormQuestions,
  updatePublicForm,
} from "@/lib/public-forms/service";
import type {
  CreatePublicFormInput,
  PublicFormQuestionInput,
  UpdatePublicFormInput,
} from "@/lib/public-forms/types";

function revalidateForms(id?: string) {
  revalidatePath("/library/public-forms");
  revalidatePath("/library");
  revalidatePath("/library/qr-campaigns");
  if (id) revalidatePath(`/library/public-forms/${id}`);
}

export async function createPublicFormAction(
  input: CreatePublicFormInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await createPublicForm(input);
  if (result.ok) revalidateForms(result.id);
  return result;
}

export async function updatePublicFormAction(
  id: string,
  patch: UpdatePublicFormInput,
): Promise<{ ok: boolean; error?: string }> {
  const result = await updatePublicForm(id, patch);
  if (result.ok) revalidateForms(id);
  return result;
}

export async function replacePublicFormQuestionsAction(
  formId: string,
  questions: PublicFormQuestionInput[],
): Promise<{ ok: boolean; error?: string }> {
  const result = await replacePublicFormQuestions(formId, questions);
  if (result.ok) revalidateForms(formId);
  return result;
}

export async function publishPublicFormAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const result = await publishPublicForm(id);
  if (result.ok) revalidateForms(id);
  return result;
}

export async function deactivatePublicFormAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const result = await deactivatePublicForm(id);
  if (result.ok) revalidateForms(id);
  return result;
}

export async function archivePublicFormAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const result = await archivePublicForm(id);
  if (result.ok) revalidateForms(id);
  return result;
}
