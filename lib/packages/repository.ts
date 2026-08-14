import { createClient } from "@/integrations/supabase/server";
import type { Package, PackageInput, PackageItem, PackageItemInput, PackageWithItems } from "@/lib/packages/types";
import { parsePackagePriceInput } from "@/lib/packages/constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;
type PkgRow = {
  id: string; venue_id: string; name: string; description: string | null;
  base_price: number | string | null; category: string | null; is_active: boolean;
  sort_order: number; source_master_key: string | null; created_at: string; updated_at: string;
};
type ItemRow = { id: string; package_id: string; venue_id: string; description: string; quantity: number; unit: string | null; sort_order: number; created_at: string; };

const map = (r: PkgRow): Package => ({
  id: r.id,
  venueId: r.venue_id,
  name: r.name,
  description: r.description,
  basePrice: r.base_price == null ? null : Number(r.base_price),
  category: r.category,
  isActive: r.is_active,
  sortOrder: r.sort_order,
  sourceMasterKey: r.source_master_key ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapItem = (r: ItemRow): PackageItem => ({
  id: r.id, packageId: r.package_id, venueId: r.venue_id, description: r.description,
  quantity: Number(r.quantity), unit: r.unit, sortOrder: r.sort_order, createdAt: r.created_at,
});

function resolveBasePrice(raw: string): number | null {
  const parsed = parsePackagePriceInput(raw);
  if (parsed == null) return null;
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

export async function getPackages(client: DbClient, venueId: string, activeOnly = false): Promise<Package[]> {
  let q = client.from("packages").select("*").eq("venue_id", venueId);
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("sort_order").order("name");
  if (error) throw error;
  return (data as PkgRow[]).map(map);
}

export async function getPackagesWithItems(client: DbClient, venueId: string, activeOnly = false): Promise<PackageWithItems[]> {
  const packages = await getPackages(client, venueId, activeOnly);
  if (packages.length === 0) return [];
  const { data, error } = await client.from("package_items")
    .select("*")
    .eq("venue_id", venueId)
    .in("package_id", packages.map((p) => p.id))
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  const byPackage = new Map<string, PackageItem[]>();
  for (const row of (data as ItemRow[] ?? [])) {
    const item = mapItem(row);
    const list = byPackage.get(item.packageId) ?? [];
    list.push(item);
    byPackage.set(item.packageId, list);
  }
  return packages.map((p) => ({ ...p, items: byPackage.get(p.id) ?? [] }));
}

export async function getPackage(client: DbClient, venueId: string, id: string): Promise<PackageWithItems | null> {
  const [pkgRes, itemsRes] = await Promise.all([
    client.from("packages").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<PkgRow>(),
    client.from("package_items").select("*").eq("package_id", id).order("sort_order").order("created_at"),
  ]);
  if (pkgRes.error) throw pkgRes.error;
  if (!pkgRes.data) return null;
  return { ...map(pkgRes.data), items: (itemsRes.data as ItemRow[] ?? []).map(mapItem) };
}

export async function insertPackageItem(client: DbClient, venueId: string, packageId: string, input: PackageItemInput): Promise<PackageItem> {
  const { data: existing } = await client.from("package_items").select("sort_order").eq("package_id", packageId).order("sort_order", { ascending: false }).limit(1);
  const sortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
  const { data, error } = await client.from("package_items")
    .insert({ package_id: packageId, venue_id: venueId, description: input.description.trim(), quantity: parseFloat(input.quantity) || 1, unit: input.unit.trim() || null, sort_order: sortOrder })
    .select().single<ItemRow>();
  if (error) throw error;
  return mapItem(data);
}

export async function deletePackageItem(client: DbClient, venueId: string, itemId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client.from("package_items").delete().eq("id", itemId).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, message: "Only an Owner or Manager can delete this." };
  return { ok: true };
}

/** Migration Center (Hospitality Success Platform §2.1) — ports Leads' dedup shape to Packages: active packages, matched by name (case-insensitive). */
export async function findActiveDuplicatePackage(client: DbClient, venueId: string, name: string): Promise<{ id: string } | null> {
  const { data } = await client.from("packages").select("id")
    .eq("venue_id", venueId).eq("is_active", true).ilike("name", name.trim())
    .limit(1).maybeSingle<{ id: string }>();
  return data ?? null;
}

export async function insertPackage(client: DbClient, venueId: string, input: PackageInput): Promise<string> {
  const { data, error } = await client.from("packages")
    .insert({
      venue_id: venueId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      base_price: resolveBasePrice(input.basePrice),
      category: input.category.trim() || null,
      is_active: input.isActive,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updatePackage(client: DbClient, venueId: string, id: string, input: PackageInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("packages") as any).update({
    name: input.name.trim(),
    description: input.description.trim() || null,
    base_price: resolveBasePrice(input.basePrice),
    category: input.category.trim() || null,
    is_active: input.isActive,
  }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deletePackage(client: DbClient, venueId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  // Both event_order_lines.package_id and invoice_line_items.package_id are
  // `on delete set null` — deleting a Package used on a past Event Order or
  // Invoice wouldn't error, it would silently orphan the reference with no
  // warning. Checked here so the venue gets a plain explanation instead,
  // matching the "used in N Automation steps" pattern Message Templates
  // already has for its own in-use check.
  const [orderLines, invoiceLines] = await Promise.all([
    client.from("event_order_lines").select("id", { count: "exact", head: true }).eq("package_id", id),
    client.from("invoice_line_items").select("id", { count: "exact", head: true }).eq("package_id", id),
  ]);
  const usageCount = (orderLines.count ?? 0) + (invoiceLines.count ?? 0);
  if (usageCount > 0) {
    return { ok: false, message: `This package is used on ${usageCount} existing Event Order${usageCount === 1 ? "" : "s"}/Invoice${usageCount === 1 ? "" : "s"} — archive it instead of deleting so those records keep their history.` };
  }

  const { data, error } = await client.from("packages").delete().eq("id", id).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, message: "Only an Owner or Manager can delete this package." };
  return { ok: true };
}

// Template Platform — Release Readiness: Duplicate, matching the identical
// pattern Playbooks/Timeline Templates/Floor Plan Templates already use — a
// fresh, independent copy of the package and every one of its line items,
// always starting active regardless of the source's state.
// source_master_key is intentionally NOT copied — duplicates are venue customs.
export async function duplicatePackage(client: DbClient, venueId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getPackage(client, venueId, sourceId);
  if (!source) throw new Error("Package not found.");
  const { data, error } = await client.from("packages")
    .insert({
      venue_id: venueId, name: newName, description: source.description,
      base_price: source.basePrice, category: source.category, is_active: true,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;

  if (source.items.length > 0) {
    const { error: itemsError } = await client.from("package_items").insert(
      source.items.map((item) => ({
        package_id: data.id, venue_id: venueId, description: item.description,
        quantity: item.quantity, unit: item.unit, sort_order: item.sortOrder,
      })),
    );
    if (itemsError) throw itemsError;
  }
  return data.id;
}
