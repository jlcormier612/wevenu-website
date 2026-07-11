"use server";

import { revalidatePath } from "next/cache";

import {
  createCategory, createItem, setItemArchived, updateItem, updateItemImage,
} from "@/lib/inventory/service";
import type {
  CreateInventoryCategoryResult, CreateInventoryItemResult, InventoryActionResult, InventoryItemInput,
} from "@/lib/inventory/types";

function revalidateLibrary() {
  revalidatePath("/library/inventory");
}

export async function createCategoryAction(name: string): Promise<CreateInventoryCategoryResult> {
  const result = await createCategory(name);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function createItemAction(input: InventoryItemInput): Promise<CreateInventoryItemResult> {
  const result = await createItem(input);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function updateItemAction(id: string, input: InventoryItemInput): Promise<InventoryActionResult> {
  const result = await updateItem(id, input);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function setItemArchivedAction(id: string, isArchived: boolean): Promise<InventoryActionResult> {
  const result = await setItemArchived(id, isArchived);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function updateItemImageAction(id: string, imageUrl: string | null): Promise<InventoryActionResult> {
  const result = await updateItemImage(id, imageUrl);
  if (result.ok) revalidateLibrary();
  return result;
}
