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
    const { data: sectionRow, error: sErr } = await client.from("event_order_template_sections").insert({
      template_id: templateId,
      venue_id: venueId,
      name: section.name,
      guidance: section.guidance ?? null,
      sort_order: sectionOrder,
    }).select("id").single<{ id: string }>();
    if (sErr) throw sErr;
    let lineOrder = 0;
    for (const offering of section.offerings ?? []) {
      const { error: lErr } = await client.from("event_order_template_lines").insert({
        template_id: templateId,
        venue_id: venueId,
        section_id: sectionRow.id,
        description: offering.name,
        description_detail: offering.description ?? null,
        quantity: offering.defaultQuantity ?? 1,
        unit_price: offering.unitPrice ?? null,
        pricing_model: offering.pricingModel,
        unit: offering.unit ?? null,
        included_by_default: offering.includedByDefault ?? false,
        sort_order: lineOrder,
      });
      if (lErr) throw lErr;
      lineOrder += 1;
    }
    sectionOrder += 1;
  }

  return templateId;
}

/**
 * Delivery starters that already exist (sections only, zero offerings) stay
 * skipped by provision. Fill matching section offerings from the master so
 * Setup Profile → event apply is not an empty shell. Never duplicates lines,
 * never mutates venue-customized templates that already have offerings.
 */
export async function repairEmptyDeliveryStarterOfferings(
  client: DbClient,
  venueId: string,
  templateId: string,
): Promise<{ repaired: boolean; linesAdded: number }> {
  const { data: header } = await client.from("event_order_templates")
    .select("id, source_master_key")
    .eq("id", templateId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string; source_master_key: string | null }>();
  if (!header?.source_master_key) return { repaired: false, linesAdded: 0 };
  const master = getEventOrderStarterMaster(header.source_master_key);
  if (!master) return { repaired: false, linesAdded: 0 };

  const { count: lineCount } = await client.from("event_order_template_lines")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  if ((lineCount ?? 0) > 0) return { repaired: false, linesAdded: 0 };

  const { data: sections } = await client.from("event_order_template_sections")
    .select("id, name")
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  const sectionByName = new Map(
    (sections ?? []).map((s: { id: string; name: string }) => [s.name, s.id]),
  );

  let linesAdded = 0;
  for (const section of master.sections) {
    const sectionId = sectionByName.get(section.name);
    if (!sectionId) continue;
    let lineOrder = 0;
    for (const offering of section.offerings ?? []) {
      const { error: lErr } = await client.from("event_order_template_lines").insert({
        template_id: templateId,
        venue_id: venueId,
        section_id: sectionId,
        description: offering.name,
        description_detail: offering.description ?? null,
        quantity: offering.defaultQuantity ?? 1,
        unit_price: offering.unitPrice ?? null,
        pricing_model: offering.pricingModel,
        unit: offering.unit ?? null,
        included_by_default: offering.includedByDefault ?? false,
        sort_order: lineOrder,
      });
      if (lErr) throw lErr;
      lineOrder += 1;
      linesAdded += 1;
    }
  }
  return { repaired: linesAdded > 0, linesAdded };
}

export async function provisionEventOrderStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[]; repaired: string[] }> {
  await archiveLegacyChecklistTemplates(client, venueId);

  const created: string[] = [];
  const skipped: string[] = [];
  const repaired: string[] = [];

  for (const master of EVENT_ORDER_STARTER_MASTERS) {
    const { data: byKey } = await client.from("event_order_templates")
      .select("id").eq("venue_id", venueId).eq("source_master_key", master.key).limit(1).maybeSingle();
    if (byKey) {
      const result = await repairEmptyDeliveryStarterOfferings(client, venueId, byKey.id);
      if (result.repaired) repaired.push(master.key);
      else skipped.push(master.key);
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
  return { created, skipped, repaired };
}

export async function seedEventOrderStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionEventOrderStarters(createAdminClient(), venueId);
}

export async function ensureEventOrderStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; repaired: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) {
    return { ok: false, created: [], skipped: [], repaired: [], message: "Backend not configured." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], repaired: [], message: "No venue found." };
  try {
    const result = await provisionEventOrderStarters(await createClient(), venue.id);
    return { ok: true, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not ensure event order starters.";
    console.error("[ensureEventOrderStartersForCurrentVenue]", message);
    return { ok: false, created: [], skipped: [], repaired: [], message };
  }
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
