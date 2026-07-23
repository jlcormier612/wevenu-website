"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createArticle, deleteArticle, updateArticle } from "@/lib/success-library/service";
import type { SuccessLibraryArticleInput } from "@/lib/success-library/types";

export async function createArticleAction(input: SuccessLibraryArticleInput) {
  const result = await createArticle(input);
  if (result.ok) {
    revalidatePath("/admin/success-library");
    redirect(`/admin/success-library/${result.id}/edit`);
  }
  return result;
}

export async function updateArticleAction(id: string, input: SuccessLibraryArticleInput) {
  const result = await updateArticle(id, input);
  if (result.ok) {
    revalidatePath("/admin/success-library");
    revalidatePath(`/admin/success-library/${id}/edit`);
    revalidatePath("/success-library");
  }
  return result;
}

export async function deleteArticleAction(id: string) {
  const result = await deleteArticle(id);
  if (result.ok) {
    revalidatePath("/admin/success-library");
    revalidatePath("/success-library");
  }
  return result;
}
