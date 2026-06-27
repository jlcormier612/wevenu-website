import { createClient } from "@/integrations/supabase/server";
import type { Package, PackageInput } from "@/lib/packages/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;
type PkgRow = { id: string; venue_id: string; name: string; description: string | null; base_price: number; category: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string; };

const map = (r: PkgRow): Package => ({ id: r.id, venueId: r.venue_id, name: r.name, description: r.description, basePrice: Number(r.base_price), category: r.category, isActive: r.is_active, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });

export async function getPackages(client: DbClient, venueId: string, activeOnly = false): Promise<Package[]> {
  let q = client.from("packages").select("*").eq("venue_id", venueId);
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("sort_order").order("name");
  if (error) throw error;
  return (data as PkgRow[]).map(map);
}

export async function getPackage(client: DbClient, venueId: string, id: string): Promise<Package | null> {
  const { data, error } = await client.from("packages").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<PkgRow>();
  if (error) throw error;
  return data ? map(data) : null;
}

export async function insertPackage(client: DbClient, venueId: string, input: PackageInput): Promise<string> {
  const { data, error } = await client.from("packages")
    .insert({ venue_id: venueId, name: input.name.trim(), description: input.description.trim() || null, base_price: parseFloat(input.basePrice.replace(/[$,]/g, "")) || 0, category: input.category.trim() || null, is_active: input.isActive })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updatePackage(client: DbClient, venueId: string, id: string, input: PackageInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("packages") as any).update({ name: input.name.trim(), description: input.description.trim() || null, base_price: parseFloat(input.basePrice.replace(/[$,]/g, "")) || 0, category: input.category.trim() || null, is_active: input.isActive }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deletePackage(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("packages").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}
