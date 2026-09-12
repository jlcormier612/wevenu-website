/**
 * Provision delivery Event Order starters into a venue Library.
 * Archives legacy checklist masters (EO-01 / EO-02) without deleting them.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  EVENT_ORDER_STARTER_MASTERS,
  LEGACY_EVENT_ORDER_STARTER_KEYS,
  getEventOrderStarterMaster,
  type EventOrderStarterMaster,
  type EventOrderStarterMasterKey,
} from "@/lib/event-order-templates/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function archiveLegacyChecklistTemplates(client: DbClient, venueId: string): Promise<void> {
  for (const key of LEGACY_EVENT_ORDER_STARTER_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("event_order_templates") as any)
      .update({ is_archived: true })
      .eq("venue_id", venueId)
      .eq("source_master_key", key)
      .eq("is_archived", false);
  }
}

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

  let sectionOrder = 0;
  for (const section of master.sections) {
    const { error: sErr } = await client.from("event_order_template_sections").insert({
      template_id: templateId,
      venue_id: venueId,
      name: section.name,
      guidance: section.guidance ?? null,
      sort_order: sectionOrder,
    });
    if (sErr) throw sErr;
    sectionOrder += 1;
  }

  return templateId;
}

export async function provisionEventOrderStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  await archiveLegacyChecklistTemplates(client, venueId);

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
      .select("id").eq("venue_id", venueId).eq("name", master.name).eq("is_archived", false).limit(1).maybeSingle();
    if (sameName) {
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
