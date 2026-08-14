/**
 * Provision Standard Wedding Event Order starters into a venue Library.
 * Masters are code fixtures — never editable DB rows.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  EVENT_ORDER_STARTER_MASTERS,
  getEventOrderStarterMaster,
  type EventOrderStarterMaster,
  type EventOrderStarterMasterKey,
} from "@/lib/event-order-templates/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertStarterFromMaster(
  client: DbClient,
  venueId: string,
  master: EventOrderStarterMaster,
  name: string,
): Promise<string> {
  const { data, error } = await client.from("event_order_templates").insert({
    venue_id: venueId,
    name,
    description: master.description,
    source_master_key: master.key,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  const templateId = data.id;

  const sectionIdByName = new Map<string, string>();
  let sectionOrder = 0;
  for (const section of master.sections) {
    const { data: sec, error: sErr } = await client.from("event_order_template_sections").insert({
      template_id: templateId,
      venue_id: venueId,
      name: section.name,
      sort_order: sectionOrder,
    }).select("id").single<{ id: string }>();
    if (sErr) throw sErr;
    sectionIdByName.set(section.name, sec.id);
    sectionOrder += 1;

    let lineOrder = 0;
    for (const line of section.lines) {
      const { error: lErr } = await client.from("event_order_template_lines").insert({
        template_id: templateId,
        venue_id: venueId,
        section_id: sec.id,
        description: line.description,
        quantity: line.quantity ?? 1,
        unit_price: line.unitPrice ?? 0,
        sort_order: lineOrder,
      });
      if (lErr) throw lErr;
      lineOrder += 1;
    }
  }

  return templateId;
}

export async function provisionEventOrderStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const master of EVENT_ORDER_STARTER_MASTERS) {
    const { data: byKey } = await client.from("event_order_templates")
      .select("id").eq("venue_id", venueId).eq("source_master_key", master.key).limit(1).maybeSingle();
    if (byKey) {
      skipped.push(master.key);
      continue;
    }

    const { data: sameName } = await client.from("event_order_templates")
      .select("id").eq("venue_id", venueId).eq("name", master.name).limit(1).maybeSingle();
    if (sameName) {
      // Preserve customized / pre-existing same-named templates (e.g. D7 leftovers).
      skipped.push(master.key);
      continue;
    }

    await insertStarterFromMaster(client, venueId, master, master.name);
    created.push(master.key);
  }
  return { created, skipped };
}

export async function seedEventOrderStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionEventOrderStarters(createAdminClient(), venueId);
}

export async function ensureEventOrderStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const result = await provisionEventOrderStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addEventOrderStarterAgain(
  masterKey: EventOrderStarterMasterKey,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getEventOrderStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const { data: byKey } = await client.from("event_order_templates")
    .select("id").eq("venue_id", venue.id).eq("source_master_key", master.key).limit(1).maybeSingle();
  if (byKey) {
    return {
      ok: false,
      message: "This starter is already in your Library. Delete it first to restore a fresh copy, or duplicate it to customize further.",
    };
  }

  const { data: existing } = await client.from("event_order_templates").select("name").eq("venue_id", venue.id);
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
