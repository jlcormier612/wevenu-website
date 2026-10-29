"use server";

import { revalidatePath } from "next/cache";

import {
  createOffering, createOfferingCategory, setOfferingArchived, updateOffering, updateOfferingImage,
} from "@/lib/offerings/service";
import type { OfferingActionResult, OfferingInput } from "@/lib/offerings/types";

function revalidate() {
  revalidatePath("/library/offerings");
  revalidatePath("/library");
}

export async function createOfferingAction(input: OfferingInput) {
  const result = await createOffering(input);
  if (result.ok) revalidate();
  return result;
}

export async function updateOfferingAction(id: string, input: OfferingInput) {
  const result = await updateOffering(id, input);
  if (result.ok) revalidate();
  return result;
}

export async function setOfferingArchivedAction(id: string, archived: boolean): Promise<OfferingActionResult> {
  const result = await setOfferingArchived(id, archived);
  if (result.ok) revalidate();
  return result;
}

export async function createOfferingCategoryAction(name: string) {
  const result = await createOfferingCategory(name);
  if (result.ok) revalidate();
  return result;
}

export async function updateOfferingImageAction(
  id: string,
  imageUrl: string | null,
): Promise<OfferingActionResult> {
  const result = await updateOfferingImage(id, imageUrl);
  if (result.ok) revalidate();
  return result;
}
