/**
 * Inventory Foundation data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemInput,
  InventoryItemWithCategory,
  InventoryShape,
  InventoryUsage,
} from "@/lib/inventory/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type CategoryRow = { id: string; venue_id: string; name: string; sort_order: number; created_at: string; updated_at: string };

type ItemRow = {
  id: string; venue_id: string; category_id: string | null; name: string;
  quantity_available: number; width: number | null; length: number | null; height: number | null;
  shape: InventoryShape | null; color: string | null; image_url: string | null; printable_name: string | null;
  is_archived: boolean; available_for_floor_plans: boolean;
  created_at: string; updated_at: string;
};

const mapCategory = (r: CategoryRow): InventoryCategory => ({
  id: r.id, venueId: r.venue_id, name: r.name, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapItem = (r: ItemRow): InventoryItem => ({
  id: r.id, venueId: r.venue_id, categoryId: r.category_id, name: r.name,
  quantityAvailable: r.quantity_available,
  width: r.width !== null ? Number(r.width) : null,
  length: r.length !== null ? Number(r.length) : null,
  height: r.height !== null ? Number(r.height) : null,
  shape: r.shape, color: r.color, imageUrl: r.image_url, printableName: r.printable_name,
  isArchived: r.is_archived, availableForFloorPlans: r.available_for_floor_plans,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---- Categories ---------------------------------------------------------------

export async function getCategories(client: DbClient, venueId: string): Promise<InventoryCategory[]> {
  const { data, error } = await client.from("inventory_categories").select("*").eq("venue_id", venueId).order("sort_order").order("name");
  if (error) throw error;
  return (data as CategoryRow[]).map(mapCategory);
}

export async function insertCategory(client: DbClient, venueId: string, name: string): Promise<string> {
  const { data, error } = await client.from("inventory_categories")
    .insert({ venue_id: venueId, name: name.trim() })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

// ---- Items ----------------------------------------------------------------------

export async function getItems(client: DbClient, venueId: string, opts?: { includeArchived?: boolean }): Promise<InventoryItem[]> {
  let query = client.from("inventory_items").select("*").eq("venue_id", venueId);
  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return (data as ItemRow[]).map(mapItem);
}

/** Active items marked available for the Floor Plan editor's toolbar (Requirement 5). */
export async function getFloorPlanEligibleItems(client: DbClient, venueId: string): Promise<InventoryItem[]> {
  const { data, error } = await client.from("inventory_items").select("*")
    .eq("venue_id", venueId).eq("is_archived", false).eq("available_for_floor_plans", true).order("name");
  if (error) throw error;
  return (data as ItemRow[]).map(mapItem);
}

export async function getItem(client: DbClient, venueId: string, id: string): Promise<InventoryItem | null> {
  const { data } = await client.from("inventory_items").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<ItemRow>();
  return data ? mapItem(data) : null;
}

/** The library card grid needs each item's category name alongside it — flat fetches + JS join, not an embedded-relationship select. */
export async function getItemsWithCategory(client: DbClient, venueId: string): Promise<InventoryItemWithCategory[]> {
  const [items, categories] = await Promise.all([getItems(client, venueId, { includeArchived: true }), getCategories(client, venueId)]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  return items.map((item) => ({ ...item, categoryName: item.categoryId ? categoryNames.get(item.categoryId) ?? null : null }));
}

function itemRow(input: InventoryItemInput) {
  return {
    name: input.name.trim(),
    category_id: input.categoryId,
    quantity_available: input.quantityAvailable,
    width: input.width,
    length: input.length,
    height: input.height,
    shape: input.shape,
    color: input.color?.trim() || null,
    printable_name: input.printableName?.trim() || null,
    available_for_floor_plans: input.availableForFloorPlans,
  };
}

export async function insertItem(client: DbClient, venueId: string, input: InventoryItemInput): Promise<string> {
  const { data, error } = await client.from("inventory_items")
    .insert({ venue_id: venueId, ...itemRow(input) })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateItem(client: DbClient, venueId: string, id: string, input: InventoryItemInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("inventory_items") as any).update(itemRow(input)).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setItemArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("inventory_items") as any).update({ is_archived: isArchived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateItemImage(client: DbClient, venueId: string, id: string, imageUrl: string | null): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("inventory_items") as any).update({ image_url: imageUrl }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Starter Inventory (Floor Plan Editor Completion, Requirement 6) --------
// Seeded once, at venue creation, as ordinary editable/archivable Inventory
// records — never read directly by the editor itself, which only ever
// consumes Inventory through the normal getFloorPlanEligibleItems() query.

type StarterItem = Omit<InventoryItemInput, "categoryId">;

const STARTER_CATEGORIES: { name: string; items: StarterItem[] }[] = [
  {
    name: "Tables",
    items: [
      { name: "60\" Round", quantityAvailable: 10, width: 60, length: 60, height: null, shape: "round", color: null, printableName: null, availableForFloorPlans: true },
      { name: "72\" Round", quantityAvailable: 10, width: 72, length: 72, height: null, shape: "round", color: null, printableName: null, availableForFloorPlans: true },
      { name: "6' Banquet", quantityAvailable: 10, width: 72, length: 30, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "8' Banquet", quantityAvailable: 10, width: 96, length: 30, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Cocktail", quantityAvailable: 8, width: 30, length: 30, height: null, shape: "round", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Sweetheart", quantityAvailable: 1, width: 48, length: 24, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
    ],
  },
  {
    name: "Seating",
    items: [
      { name: "Chair", quantityAvailable: 150, width: 20, length: 20, height: null, shape: "square", color: null, printableName: null, availableForFloorPlans: true },
    ],
  },
  {
    name: "Reception",
    items: [
      { name: "Dance Floor", quantityAvailable: 1, width: 144, length: 144, height: null, shape: "custom", color: null, printableName: null, availableForFloorPlans: true },
      { name: "DJ", quantityAvailable: 1, width: 96, length: 48, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Stage", quantityAvailable: 1, width: 200, length: 80, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Bar", quantityAvailable: 1, width: 140, length: 50, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Buffet", quantityAvailable: 1, width: 96, length: 30, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Cake Table", quantityAvailable: 1, width: 60, length: 40, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
    ],
  },
  {
    name: "Ceremony",
    items: [
      { name: "Arbor", quantityAvailable: 1, width: 80, length: 20, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Altar", quantityAvailable: 1, width: 60, length: 30, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Aisle", quantityAvailable: 1, width: 40, length: 200, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
    ],
  },
  {
    name: "Miscellaneous",
    items: [
      { name: "Gift Table", quantityAvailable: 1, width: 90, length: 40, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Sign-in Table", quantityAvailable: 1, width: 72, length: 24, height: null, shape: "rectangular", color: null, printableName: null, availableForFloorPlans: true },
      { name: "Lounge Seating", quantityAvailable: 2, width: 80, length: 80, height: null, shape: "custom", color: null, printableName: null, availableForFloorPlans: true },
    ],
  },
];

/**
 * Runs once, right after a venue finishes setup, so the Floor Plan editor
 * has real inventory to work with immediately (Requirement 6) instead of
 * an empty toolbar. Ordinary rows in inventory_categories/inventory_items —
 * fully editable and archivable by the venue afterward, same as anything
 * they'd add by hand. Not idempotent by itself; callers should only invoke
 * this once, at venue creation.
 */
export async function seedStarterInventory(client: DbClient, venueId: string): Promise<void> {
  for (let i = 0; i < STARTER_CATEGORIES.length; i++) {
    const { name, items } = STARTER_CATEGORIES[i];
    const { data: category, error: categoryError } = await client.from("inventory_categories")
      .insert({ venue_id: venueId, name, sort_order: i })
      .select("id").single<{ id: string }>();
    if (categoryError) throw categoryError;

    const rows = items.map((item) => ({ venue_id: venueId, ...itemRow({ ...item, categoryId: category.id }) }));
    const { error: itemsError } = await client.from("inventory_items").insert(rows);
    if (itemsError) throw itemsError;
  }
}

// ---- Usage reporting (Requirement 6 — reporting only, never enforced) --------

/**
 * How much of each inventory item is placed across every floor plan on one
 * booking. Reads floor_plan_objects/floor_plans but writes nothing and
 * blocks nothing — purely informational.
 */
export async function getUsageForEvent(client: DbClient, venueId: string, eventId: string): Promise<InventoryUsage[]> {
  const { data: plans, error: plansError } = await client.from("floor_plans").select("id").eq("venue_id", venueId).eq("event_id", eventId);
  if (plansError) throw plansError;
  const planIds = (plans as { id: string }[]).map((p) => p.id);
  if (planIds.length === 0) return [];

  const { data: objs, error: objsError } = await client.from("floor_plan_objects").select("inventory_item_id")
    .eq("venue_id", venueId).in("floor_plan_id", planIds).not("inventory_item_id", "is", null);
  if (objsError) throw objsError;

  const counts = new Map<string, number>();
  for (const row of objs as { inventory_item_id: string }[]) counts.set(row.inventory_item_id, (counts.get(row.inventory_item_id) ?? 0) + 1);
  if (counts.size === 0) return [];

  const { data: items, error: itemsError } = await client.from("inventory_items").select("id, name, printable_name, quantity_available")
    .in("id", [...counts.keys()]);
  if (itemsError) throw itemsError;

  return (items as { id: string; name: string; printable_name: string | null; quantity_available: number }[]).map((i) => ({
    itemId: i.id,
    name: i.printable_name || i.name,
    quantityAvailable: i.quantity_available,
    quantityUsed: counts.get(i.id) ?? 0,
  }));
}
