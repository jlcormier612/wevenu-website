/**
 * Provision Hello to Cheers Floor Plan starters (FP-01 / FP-02)
 * into a venue Library. Masters are code fixtures — never editable DB rows.
 * Venue copies are independent; provision never overwrites customizations.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  FLOOR_PLAN_STARTER_MASTERS,
  getFloorPlanStarterMaster,
  shouldSkipFloorPlanStarterProvision,
  type FloorPlanStarterMaster,
  type FloorPlanStarterMasterKey,
} from "@/lib/floor-plan-templates/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertStarterFromMaster(
  client: DbClient,
  venueId: string,
  master: FloorPlanStarterMaster,
  name: string,
): Promise<string> {
  const { data, error } = await client.from("floor_plan_templates").insert({
    venue_id: venueId,
    name,
    event_type: master.eventType,
    space_id: null,
    is_default: false,
    is_archived: false,
    room_width_ft: master.roomWidthFt,
    room_depth_ft: master.roomDepthFt,
    measurement_unit: master.measurementUnit,
    source_master_key: master.key,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  const templateId = data.id;

  const rows = master.objects.map((o, i) => ({
    venue_id: venueId,
    template_id: templateId,
    object_type: o.objectType,
    label: o.label,
    capacity: o.capacity,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    rotation: o.rotation,
    sort_order: i,
    inventory_item_id: null,
    color: null,
    notes: null,
    locked: false,
    display_shape: o.displayShape,
  }));
  if (rows.length > 0) {
    const { error: objErr } = await client.from("floor_plan_template_objects").insert(rows);
    if (objErr) throw objErr;
  }
  return templateId;
}

export async function provisionFloorPlanStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const [{ data: byKeyRows }, { data: nameRows }] = await Promise.all([
    client.from("floor_plan_templates").select("source_master_key").eq("venue_id", venueId).not("source_master_key", "is", null),
    client.from("floor_plan_templates").select("name").eq("venue_id", venueId),
  ]);
  const existingByKey = new Set(
    (byKeyRows ?? [])
      .map((r: { source_master_key: string | null }) => r.source_master_key)
      .filter((k): k is string => Boolean(k)),
  );
  const existingNames = new Set((nameRows ?? []).map((r: { name: string }) => r.name));

  for (const master of FLOOR_PLAN_STARTER_MASTERS) {
    const decision = shouldSkipFloorPlanStarterProvision({
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

export async function seedFloorPlanStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionFloorPlanStarters(createAdminClient(), venueId);
}

export async function ensureFloorPlanStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const result = await provisionFloorPlanStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addFloorPlanStarterAgain(
  masterKey: FloorPlanStarterMasterKey,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getFloorPlanStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const { data: byKey } = await client.from("floor_plan_templates")
    .select("id").eq("venue_id", venue.id).eq("source_master_key", master.key).limit(1).maybeSingle();
  if (byKey) {
    return {
      ok: false,
      message: "This starter is already in your Library. Delete it first to restore a fresh copy, or duplicate it to customize further.",
    };
  }

  const { data: existing } = await client.from("floor_plan_templates").select("name").eq("venue_id", venue.id);
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
    const templateId = await insertStarterFromMaster(client, venue.id, master, name);
    return { ok: true, templateId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add starter." };
  }
}
