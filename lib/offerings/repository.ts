/**
 * Offerings data access — venue-scoped reusable delivery catalog.
 */
import { createClient } from "@/integrations/supabase/server";
import type { Offering, OfferingCategory, OfferingInput, OfferingWithCategory } from "@/lib/offerings/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type CategoryRow = {
  id: string; venue_id: string; name: string; sort_order: number;
  created_at: string; updated_at: string;
};

type OfferingRow = {
  id: string; venue_id: string; category_id: string | null; name: string;
  description: string | null; unit: string | null;
  default_unit_price: number | null; inventory_item_id: string | null;
  is_archived: boolean; sort_order: number;
  created_at: string; updated_at: string;
};

const mapCategory = (r: CategoryRow): OfferingCategory => ({
  id: r.id, venueId: r.venue_id, name: r.name, sortOrder: r.sort_order,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapOffering = (r: OfferingRow): Offering => ({
  id: r.id, venueId: r.venue_id, categoryId: r.category_id, name: r.name,
  description: r.description, unit: r.unit,
  defaultUnitPrice: r.default_unit_price != null ? Number(r.default_unit_price) : null,
  inventoryItemId: r.inventory_item_id, isArchived: r.is_archived, sortOrder: r.sort_order,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function getCategories(client: DbClient, venueId: string): Promise<OfferingCategory[]> {
  const { data, error } = await client.from("offering_categories")
    .select("*").eq("venue_id", venueId).order("sort_order").order("name");
  if (error) throw error;
  return (data as CategoryRow[]).map(mapCategory);
}

export async function insertCategory(client: DbClient, venueId: string, name: string): Promise<string> {
  const { data, error } = await client.from("offering_categories")
    .insert({ venue_id: venueId, name: name.trim() })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function getOfferings(
  client: DbClient, venueId: string, opts?: { includeArchived?: boolean },
): Promise<Offering[]> {
  let query = client.from("offerings").select("*").eq("venue_id", venueId);
  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query.order("sort_order").order("name");
  if (error) throw error;
  return (data as OfferingRow[]).map(mapOffering);
}

export async function getOfferingsWithCategory(
  client: DbClient, venueId: string,
): Promise<OfferingWithCategory[]> {
  const [items, categories] = await Promise.all([
    getOfferings(client, venueId, { includeArchived: true }),
    getCategories(client, venueId),
  ]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return items.map((o) => ({
    ...o,
    categoryName: o.categoryId ? names.get(o.categoryId) ?? null : null,
  }));
}

export async function getOffering(client: DbClient, venueId: string, id: string): Promise<Offering | null> {
  const { data } = await client.from("offerings").select("*")
    .eq("id", id).eq("venue_id", venueId).maybeSingle<OfferingRow>();
  return data ? mapOffering(data) : null;
}

function offeringRow(input: OfferingInput) {
  const priceRaw = input.defaultUnitPrice.replace(/[$,]/g, "").trim();
  const defaultUnitPrice = priceRaw === "" ? null : parseFloat(priceRaw);
  return {
    name: input.name.trim(),
    category_id: input.categoryId,
    description: input.description.trim() || null,
    unit: input.unit.trim() || null,
    default_unit_price: defaultUnitPrice != null && !Number.isNaN(defaultUnitPrice) ? defaultUnitPrice : null,
    inventory_item_id: input.inventoryItemId,
  };
}

export async function insertOffering(client: DbClient, venueId: string, input: OfferingInput): Promise<string> {
  const { data: existing } = await client.from("offerings")
    .select("sort_order").eq("venue_id", venueId).order("sort_order", { ascending: false }).limit(1);
  const sortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
  const { data, error } = await client.from("offerings")
    .insert({ venue_id: venueId, ...offeringRow(input), sort_order: sortOrder })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateOffering(
  client: DbClient, venueId: string, id: string, input: OfferingInput,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("offerings") as any)
    .update(offeringRow(input)).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setOfferingArchived(
  client: DbClient, venueId: string, id: string, archived: boolean,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("offerings") as any)
    .update({ is_archived: archived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}
