/**
 * Inventory Foundation application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/inventory/repository";
import type {
  CreateInventoryCategoryResult,
  CreateInventoryItemResult,
  InventoryActionResult,
  InventoryCategory,
  InventoryItem,
  InventoryItemInput,
  InventoryItemWithCategory,
  InventoryUsage,
} from "@/lib/inventory/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | InventoryActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

// ---- Categories ---------------------------------------------------------------

export async function getCategories(): Promise<InventoryCategory[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getCategories(await createClient(), venue.id);
}

export async function createCategory(name: string): Promise<CreateInventoryCategoryResult> {
  if (!name.trim()) return { ok: false, message: "Category name is required." };
  const result = await withVenue(async (supabase, venueId) => {
    const categoryId = await repo.insertCategory(supabase, venueId, name);
    return { ok: true, categoryId } as CreateInventoryCategoryResult;
  });
  return result as CreateInventoryCategoryResult;
}

// ---- Items ----------------------------------------------------------------------

export async function getItems(): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getItems(await createClient(), venue.id);
}

export async function getItem(id: string): Promise<InventoryItem | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getItem(await createClient(), venue.id, id);
}

/** The Inventory Library's card grid — every item including archived. */
export async function getItemsForLibrary(): Promise<InventoryItemWithCategory[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getItemsWithCategory(await createClient(), venue.id);
}

/** The Floor Plan editor's toolbar (Requirement 5) — only items the venue has opted in for floor plan use. */
export async function getFloorPlanEligibleItems(): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getFloorPlanEligibleItems(await createClient(), venue.id);
}

function validate(input: InventoryItemInput): string | null {
  if (!input.name.trim()) return "Item name is required.";
  if (input.quantityAvailable < 0) return "Quantity available can't be negative.";
  return null;
}

export async function createItem(input: InventoryItemInput): Promise<CreateInventoryItemResult> {
  const error = validate(input);
  if (error) return { ok: false, message: error };
  const result = await withVenue(async (supabase, venueId) => {
    const itemId = await repo.insertItem(supabase, venueId, input);
    return { ok: true, itemId } as CreateInventoryItemResult;
  });
  return result as CreateInventoryItemResult;
}

export async function updateItem(id: string, input: InventoryItemInput): Promise<InventoryActionResult> {
  const error = validate(input);
  if (error) return { ok: false, message: error };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateItem(supabase, venueId, id, input);
    return { ok: true } as InventoryActionResult;
  });
  return result as InventoryActionResult;
}

export async function setItemArchived(id: string, isArchived: boolean): Promise<InventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setItemArchived(supabase, venueId, id, isArchived);
    return { ok: true } as InventoryActionResult;
  });
  return result as InventoryActionResult;
}

export async function updateItemImage(id: string, imageUrl: string | null): Promise<InventoryActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateItemImage(supabase, venueId, id, imageUrl);
    return { ok: true } as InventoryActionResult;
  });
  return result as InventoryActionResult;
}

/**
 * Seeds a new venue's Starter Inventory (Floor Plan Editor Completion,
 * Requirement 6) — ordinary, editable/archivable inventory_categories/
 * inventory_items rows, not a hardcoded list inside the editor. Called once
 * from lib/venue/service.ts right after a venue finishes setup; failures
 * are logged and swallowed there so a seeding issue never blocks venue
 * creation itself.
 */
export async function seedStarterInventory(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await repo.seedStarterInventory(await createClient(), venueId);
}

// ---- Usage reporting (Requirement 6) -------------------------------------------

export async function getUsageForEvent(eventId: string): Promise<InventoryUsage[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getUsageForEvent(await createClient(), venue.id, eventId);
}
