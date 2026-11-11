"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { StockSharingMode } from "@/lib/inventory/reservations";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

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

export async function updateStockSharingAction(
  mode: StockSharingMode, turnaroundMinutes: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (mode !== "same_day" && mode !== "by_time") return { ok: false, message: "Choose how events share stock." };
  const minutes = Math.round(Number(turnaroundMinutes));
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
    return { ok: false, message: "Turnaround must be between 0 and 24 hours." };
  }
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  if (role !== "owner" && role !== "manager") {
    return { ok: false, message: "Only an Owner or Manager can change this setting." };
  }
  const { data, error } = await createAdminClient()
    .from("venues")
    .update({ inventory_sharing_mode: mode, inventory_turnaround_minutes: minutes })
    .eq("id", venue.id)
    .select("inventory_sharing_mode")
    .maybeSingle<{ inventory_sharing_mode: string }>();
  if (error || data?.inventory_sharing_mode !== mode) return { ok: false, message: "Could not save this setting." };
  revalidateLibrary();
  return { ok: true };
}
