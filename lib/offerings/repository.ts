/**
 * Offerings data access — venue-scoped reusable delivery catalog.
 */
import { createClient } from "@/integrations/supabase/server";
import { formatParentOfferingNames } from "@/lib/offerings/hierarchy";
import type { Offering, OfferingCategory, OfferingInput, OfferingWithCategory } from "@/lib/offerings/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type CategoryRow = {
  id: string; venue_id: string; name: string; sort_order: number;
  created_at: string; updated_at: string;
};

type OfferingRow = {
  id: string; venue_id: string; category_id: string | null;
  parent_offering_id: string | null;
  name: string;
  description: string | null; unit: string | null;
  default_unit_price: number | null; inventory_item_id: string | null;
  is_archived: boolean; sort_order: number;
  created_at: string; updated_at: string;
};

type LinkRow = {
  offering_id: string;
  parent_offering_id: string;
};

const mapCategory = (r: CategoryRow): OfferingCategory => ({
  id: r.id, venueId: r.venue_id, name: r.name, sortOrder: r.sort_order,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

function mapOffering(r: OfferingRow, parentOfferingIds: string[]): Offering {
  return {
    id: r.id, venueId: r.venue_id, categoryId: r.category_id,
    parentOfferingIds,
    parentOfferingId: parentOfferingIds[0] ?? r.parent_offering_id ?? null,
    name: r.name,
    description: r.description, unit: r.unit,
    defaultUnitPrice: r.default_unit_price != null ? Number(r.default_unit_price) : null,
    inventoryItemId: r.inventory_item_id, isArchived: r.is_archived, sortOrder: r.sort_order,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function loadParentLinks(
  client: DbClient,
  venueId: string,
): Promise<Map<string, string[]>> {
  const { data, error } = await client
    .from("offering_major_links")
    .select("offering_id, parent_offering_id")
    .eq("venue_id", venueId);
  if (error) throw error;
  const map = new Map<string, string[]>();
  for (const row of (data as LinkRow[] | null) ?? []) {
    const list = map.get(row.offering_id) ?? [];
    list.push(row.parent_offering_id);
    map.set(row.offering_id, list);
  }
  return map;
}

/**
 * Replace major associations for one offering. Syncs denormalized parent_offering_id
 * to the first parent (by parent name) or null. Idempotent.
 */
export async function replaceOfferingMajorLinks(
  client: DbClient,
  venueId: string,
  offeringId: string,
  parentOfferingIds: string[],
): Promise<string[]> {
  const unique = [...new Set(parentOfferingIds.filter(Boolean))];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (client.from("offering_major_links") as any)
    .delete()
    .eq("venue_id", venueId)
    .eq("offering_id", offeringId);
  if (delErr) throw delErr;

  if (unique.length > 0) {
    const rows = unique.map((parent_offering_id) => ({
      venue_id: venueId,
      offering_id: offeringId,
      parent_offering_id,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (client.from("offering_major_links") as any).insert(rows);
    if (insErr) throw insErr;
  }

  // Sort primary by parent name for stable denormalized FK.
  let primary: string | null = null;
  if (unique.length > 0) {
    const { data: parents } = await client
      .from("offerings")
      .select("id, name")
      .eq("venue_id", venueId)
      .in("id", unique);
    const names = new Map(
      ((parents as { id: string; name: string }[] | null) ?? []).map((p) => [p.id, p.name]),
    );
    primary = [...unique].sort((a, b) =>
      (names.get(a) ?? a).localeCompare(names.get(b) ?? b),
    )[0] ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: syncErr } = await (client.from("offerings") as any)
    .update({ parent_offering_id: primary })
    .eq("id", offeringId)
    .eq("venue_id", venueId);
  if (syncErr) throw syncErr;

  return primary ? [primary, ...unique.filter((id) => id !== primary)] : [];
}

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
  const links = await loadParentLinks(client, venueId);
  return (data as OfferingRow[]).map((r) => {
    const fromLinks = links.get(r.id);
    const parentOfferingIds =
      fromLinks && fromLinks.length > 0
        ? fromLinks
        : r.parent_offering_id
          ? [r.parent_offering_id]
          : [];
    return mapOffering(r, parentOfferingIds);
  });
}

export async function getOfferingsWithCategory(
  client: DbClient, venueId: string,
): Promise<OfferingWithCategory[]> {
  const [items, categories] = await Promise.all([
    getOfferings(client, venueId, { includeArchived: true }),
    getCategories(client, venueId),
  ]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const offeringNames = new Map(items.map((o) => [o.id, o.name]));
  return items.map((o) => {
    const parentOfferingNames = o.parentOfferingIds
      .map((id) => offeringNames.get(id))
      .filter((n): n is string => Boolean(n));
    // Stable display order by name
    parentOfferingNames.sort((a, b) => a.localeCompare(b));
    return {
      ...o,
      categoryName: o.categoryId ? names.get(o.categoryId) ?? null : null,
      parentOfferingNames,
      parentOfferingName: formatParentOfferingNames(parentOfferingNames),
    };
  });
}

export async function getOffering(client: DbClient, venueId: string, id: string): Promise<Offering | null> {
  const { data } = await client.from("offerings").select("*")
    .eq("id", id).eq("venue_id", venueId).maybeSingle<OfferingRow>();
  if (!data) return null;
  const links = await loadParentLinks(client, venueId);
  const fromLinks = links.get(id);
  const parentOfferingIds =
    fromLinks && fromLinks.length > 0
      ? fromLinks
      : data.parent_offering_id
        ? [data.parent_offering_id]
        : [];
  return mapOffering(data, parentOfferingIds);
}

function offeringRow(input: OfferingInput) {
  const priceRaw = input.defaultUnitPrice.replace(/[$,]/g, "").trim();
  const defaultUnitPrice = priceRaw === "" ? null : parseFloat(priceRaw);
  const parentIds = [...new Set((input.parentOfferingIds ?? []).filter(Boolean))];
  return {
    name: input.name.trim(),
    category_id: input.categoryId,
    // Temporary primary; replaceOfferingMajorLinks overwrites after insert/update.
    parent_offering_id: parentIds[0] ?? null,
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
  await replaceOfferingMajorLinks(client, venueId, data.id, input.parentOfferingIds ?? []);
  return data.id;
}

export async function updateOffering(
  client: DbClient, venueId: string, id: string, input: OfferingInput,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("offerings") as any)
    .update(offeringRow(input)).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
  await replaceOfferingMajorLinks(client, venueId, id, input.parentOfferingIds ?? []);
}

export async function setOfferingArchived(
  client: DbClient, venueId: string, id: string, archived: boolean,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("offerings") as any)
    .update({ is_archived: archived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}
