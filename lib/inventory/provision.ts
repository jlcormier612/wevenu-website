/**
 * Provision Standard Wedding Inventory catalog + Inventory Templates.
 * Masters are code fixtures — venue copies are independent and never overwrite customs.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  INVENTORY_CATALOG_STARTER_CATEGORIES,
  INVENTORY_TEMPLATE_STARTER_MASTERS,
  getInventoryTemplateStarterMaster,
  type InventoryTemplateStarterKey,
  type InventoryTemplateStarterMaster,
} from "@/lib/inventory/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function provisionCatalog(client: DbClient, venueId: string): Promise<"created" | "skipped"> {
  const { data: existing } = await client.from("inventory_categories")
    .select("id").eq("venue_id", venueId).eq("source_master_key", "INV-CAT-tables").limit(1).maybeSingle();
  if (existing) return "skipped";

  // If the venue already has a hand-built (or legacy floor-plan) catalog, do not dump starters on top.
  const { count } = await client.from("inventory_categories")
    .select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  if ((count ?? 0) > 0) return "skipped";

  for (let i = 0; i < INVENTORY_CATALOG_STARTER_CATEGORIES.length; i++) {
    const cat = INVENTORY_CATALOG_STARTER_CATEGORIES[i];
    const { data: category, error: catErr } = await client.from("inventory_categories").insert({
      venue_id: venueId,
      name: cat.name,
      sort_order: i,
      source_master_key: cat.key,
    }).select("id").single<{ id: string }>();
    if (catErr) throw catErr;

    const rows = cat.items.map((item) => ({
      venue_id: venueId,
      category_id: category.id,
      name: item.name,
      quantity_available: 0,
      width: item.width,
      length: item.length,
      height: item.height,
      shape: item.shape,
      color: null,
      printable_name: null,
      available_for_floor_plans: item.availableForFloorPlans,
    }));
    const { error: itemsErr } = await client.from("inventory_items").insert(rows);
    if (itemsErr) throw itemsErr;
  }
  return "created";
}

async function insertTemplateFromMaster(
  client: DbClient,
  venueId: string,
  master: InventoryTemplateStarterMaster,
  name: string,
): Promise<string> {
  const { data: catalogItems } = await client.from("inventory_items")
    .select("id, name").eq("venue_id", venueId).eq("is_archived", false);
  const byName = new Map((catalogItems ?? []).map((r: { id: string; name: string }) => [r.name.toLowerCase(), r.id]));

  const { data, error } = await client.from("inventory_templates").insert({
    venue_id: venueId,
    name,
    description: master.description,
    source_master_key: master.key,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  const templateId = data.id;

  const rows = master.items.map((item, i) => ({
    template_id: templateId,
    venue_id: venueId,
    inventory_item_id: byName.get(item.name.toLowerCase()) ?? null,
    name: item.name,
    category: item.category,
    quantity: 1,
    unit_price: null,
    is_included: true,
    notes: null,
    sort_order: i,
  }));
  if (rows.length > 0) {
    const { error: itemsErr } = await client.from("inventory_template_items").insert(rows);
    if (itemsErr) throw itemsErr;
  }
  return templateId;
}

async function provisionTemplates(client: DbClient, venueId: string): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const master of INVENTORY_TEMPLATE_STARTER_MASTERS) {
    const { data: byKey } = await client.from("inventory_templates")
      .select("id").eq("venue_id", venueId).eq("source_master_key", master.key).limit(1).maybeSingle();
    if (byKey) {
      skipped.push(master.key);
      continue;
    }
    const { data: sameName } = await client.from("inventory_templates")
      .select("id").eq("venue_id", venueId).eq("name", master.name).limit(1).maybeSingle();
    if (sameName) {
      skipped.push(master.key);
      continue;
    }
    await insertTemplateFromMaster(client, venueId, master, master.name);
    created.push(master.key);
  }
  return { created, skipped };
}

export async function provisionInventoryStarters(
  client: DbClient,
  venueId: string,
): Promise<{ catalog: "created" | "skipped"; templates: { created: string[]; skipped: string[] } }> {
  const catalog = await provisionCatalog(client, venueId);
  const templates = await provisionTemplates(client, venueId);
  return { catalog, templates };
}

/** Venue-create seed — replaces legacy non-idempotent floor-plan-only catalog seed. */
export async function seedStarterInventory(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionInventoryStarters(createAdminClient(), venueId);
}

export async function ensureInventoryStartersForCurrentVenue(): Promise<{
  ok: boolean;
  catalog?: "created" | "skipped";
  templates?: { created: string[]; skipped: string[] };
  message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const result = await provisionInventoryStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addInventoryTemplateStarterAgain(
  masterKey: InventoryTemplateStarterKey,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getInventoryTemplateStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const { data: byKey } = await client.from("inventory_templates")
    .select("id").eq("venue_id", venue.id).eq("source_master_key", master.key).limit(1).maybeSingle();
  if (byKey) {
    return {
      ok: false,
      message: "This starter is already in your Library. Delete it first to restore a fresh copy, or duplicate it to customize further.",
    };
  }

  const { data: existing } = await client.from("inventory_templates").select("name").eq("venue_id", venue.id);
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
    // Ensure catalog examples exist when restoring templates on an empty catalog venue.
    await provisionCatalog(client, venue.id);
    const templateId = await insertTemplateFromMaster(client, venue.id, master, name);
    return { ok: true, templateId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add starter." };
  }
}
