/**
 * Provision Hello to Cheers Package starters (PKG-01 / PKG-02 / PKG-03)
 * into a venue Library. Masters are code fixtures — never editable DB rows.
 * Venue copies are independent; provision never overwrites customizations.
 * Zero financial side effects — no invoices, payment plans, or revenue.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  PACKAGE_STARTER_MASTERS,
  getPackageStarterMaster,
  shouldSkipPackageStarterProvision,
  type PackageStarterMaster,
  type PackageStarterMasterKey,
} from "@/lib/packages/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertStarterFromMaster(
  client: DbClient,
  venueId: string,
  master: PackageStarterMaster,
  name: string,
): Promise<string> {
  const { data, error } = await client.from("packages").insert({
    venue_id: venueId,
    name,
    description: master.description,
    base_price: null,
    category: master.category,
    is_active: true,
    sort_order: master.sortOrder,
    source_master_key: master.key,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  const packageId = data.id;

  const rows = master.items.map((item, i) => ({
    package_id: packageId,
    venue_id: venueId,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    sort_order: i,
  }));
  if (rows.length > 0) {
    const { error: itemsErr } = await client.from("package_items").insert(rows);
    if (itemsErr) throw itemsErr;
  }
  return packageId;
}

export async function provisionPackageStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const [{ data: byKeyRows }, { data: nameRows }] = await Promise.all([
    client.from("packages").select("source_master_key").eq("venue_id", venueId).not("source_master_key", "is", null),
    client.from("packages").select("name").eq("venue_id", venueId),
  ]);
  const existingByKey = new Set(
    (byKeyRows ?? [])
      .map((r: { source_master_key: string | null }) => r.source_master_key)
      .filter((k): k is string => Boolean(k)),
  );
  const existingNames = new Set((nameRows ?? []).map((r: { name: string }) => r.name));

  for (const master of PACKAGE_STARTER_MASTERS) {
    const decision = shouldSkipPackageStarterProvision({
      masterKey: master.key,
      masterName: master.name,
      existingByKey,
      existingNames,
    });
    if (decision !== "create") {
      skipped.push(master.key);
      continue;
    }

    await insertStarterFromMaster(client, venueId, master, master.name);
    existingByKey.add(master.key);
    existingNames.add(master.name);
    created.push(master.key);
  }
  return { created, skipped };
}

export async function seedPackageStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionPackageStarters(createAdminClient(), venueId);
}

export async function ensurePackageStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const result = await provisionPackageStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addPackageStarterAgain(
  masterKey: PackageStarterMasterKey,
): Promise<{ ok: true; packageId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getPackageStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const { data: byKey } = await client.from("packages")
    .select("id").eq("venue_id", venue.id).eq("source_master_key", master.key).limit(1).maybeSingle();
  if (byKey) {
    return {
      ok: false,
      message: "This starter is already in your Library. Delete it first to restore a fresh copy, or duplicate it to customize further.",
    };
  }

  const { data: existing } = await client.from("packages").select("name").eq("venue_id", venue.id);
  const names = new Set((existing ?? []).map((r: { name: string }) => r.name));
  let name = master.name;
  if (names.has(name)) {
    name = `${master.name} (Starter)`;
    let n = 2;
    while (names.has(name)) {
      name = `${master.name} (Starter ${n})`;
      n += 1;
    }
  }

  try {
    const packageId = await insertStarterFromMaster(client, venue.id, master, name);
    return { ok: true, packageId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add starter." };
  }
}
