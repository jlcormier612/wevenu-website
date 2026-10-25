/**
 * Provision delivery Event Order starters into a venue Library.
 * Archives legacy checklist masters (EO-01 / EO-02) without deleting them.
 *
 * New venues get corrected masters (included lines + choice groups).
 * Uncustomized legacy flat copies (zero groups, exact legacy line names) are
 * upgraded in place once. Customized templates and event-specific orders are
 * never overwritten.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  EVENT_ORDER_STARTER_MASTERS,
  LEGACY_EVENT_ORDER_STARTER_KEYS,
  getEventOrderStarterMaster,
  isUncustomizedLegacyFlatStarter,
  type EventOrderStarterChoiceGroup,
  type EventOrderStarterMaster,
  type EventOrderStarterMasterKey,
  type EventOrderStarterOffering,
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

async function insertSectionOfferings(
  client: DbClient,
  venueId: string,
  templateId: string,
  sectionId: string,
  offerings: EventOrderStarterOffering[],
): Promise<void> {
  let lineOrder = 0;
  for (const offering of offerings) {
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
  }
}

async function insertSectionChoiceGroups(
  client: DbClient,
  venueId: string,
  templateId: string,
  sectionId: string,
  groups: EventOrderStarterChoiceGroup[],
  groupSortStart: number,
  /** Label → option id for resolving dependsOnOptionNames within this template. */
  optionIdsByLabel: Map<string, string>,
): Promise<number> {
  let groupOrder = groupSortStart;
  for (const group of groups) {
    const dependsOn = (group.dependsOnOptionNames ?? [])
      .map((label) => optionIdsByLabel.get(label.trim()))
      .filter((id): id is string => typeof id === "string");
    const { data: groupRow, error: gErr } = await client.from("event_order_template_groups").insert({
      template_id: templateId,
      venue_id: venueId,
      section_id: sectionId,
      name: group.name,
      instructions: group.instructions ?? null,
      selection_mode: group.selectionMode,
      min_select: group.minSelect,
      max_select: group.maxSelect,
      allow_quantity: group.allowQuantity ?? false,
      depends_on_option_ids: dependsOn,
      sort_order: groupOrder,
    }).select("id").single<{ id: string }>();
    if (gErr) throw gErr;
    let optOrder = 0;
    for (const opt of group.options) {
      const isIncluded = opt.isIncluded ?? false;
      const { data: optRow, error: oErr } = await client.from("event_order_template_options").insert({
        template_id: templateId,
        venue_id: venueId,
        group_id: groupRow.id,
        offering_id: null,
        label: opt.name,
        description: opt.description ?? null,
        is_included: isIncluded,
        unit_price: isIncluded ? 0 : (opt.unitPrice ?? null),
        is_default: opt.isDefault ?? false,
        sort_order: optOrder,
      }).select("id").single<{ id: string }>();
      if (oErr) throw oErr;
      // First label wins — parent options are unique in starters.
      if (!optionIdsByLabel.has(opt.name.trim())) {
        optionIdsByLabel.set(opt.name.trim(), optRow.id);
      }
      optOrder += 1;
    }
    groupOrder += 1;
  }
  return groupOrder;
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
  let groupOrder = 0;
  const optionIdsByLabel = new Map<string, string>();
  for (const section of master.sections) {
    const { data: sectionRow, error: sErr } = await client.from("event_order_template_sections").insert({
      template_id: templateId,
      venue_id: venueId,
      name: section.name,
      guidance: section.guidance ?? null,
      sort_order: sectionOrder,
    }).select("id").single<{ id: string }>();
    if (sErr) throw sErr;
    await insertSectionOfferings(client, venueId, templateId, sectionRow.id, section.offerings ?? []);
    groupOrder = await insertSectionChoiceGroups(
      client, venueId, templateId, sectionRow.id, section.choiceGroups ?? [], groupOrder, optionIdsByLabel,
    );
    sectionOrder += 1;
  }

  return templateId;
}

/**
 * Delivery starters that already exist (sections only, zero offerings) stay
 * skipped by provision. Fill matching section offerings + choice groups from
 * the master so Setup Profile → event apply is not an empty shell. Never
 * duplicates lines, never mutates venue-customized templates that already
 * have offerings or groups.
 */
export async function repairEmptyDeliveryStarterOfferings(
  client: DbClient,
  venueId: string,
  templateId: string,
): Promise<{ repaired: boolean; linesAdded: number; groupsAdded: number }> {
  const { data: header } = await client.from("event_order_templates")
    .select("id, source_master_key")
    .eq("id", templateId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string; source_master_key: string | null }>();
  if (!header?.source_master_key) return { repaired: false, linesAdded: 0, groupsAdded: 0 };
  const master = getEventOrderStarterMaster(header.source_master_key);
  if (!master) return { repaired: false, linesAdded: 0, groupsAdded: 0 };

  const { count: lineCount } = await client.from("event_order_template_lines")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  const { count: groupCount } = await client.from("event_order_template_groups")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  if ((lineCount ?? 0) > 0 || (groupCount ?? 0) > 0) {
    return { repaired: false, linesAdded: 0, groupsAdded: 0 };
  }

  const { data: sections } = await client.from("event_order_template_sections")
    .select("id, name")
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  const sectionByName = new Map(
    (sections ?? []).map((s: { id: string; name: string }) => [s.name, s.id]),
  );

  let linesAdded = 0;
  let groupsAdded = 0;
  let groupOrder = 0;
  const optionIdsByLabel = new Map<string, string>();
  for (const section of master.sections) {
    let sectionId = sectionByName.get(section.name);
    if (!sectionId) {
      const { data: created, error: sErr } = await client.from("event_order_template_sections").insert({
        template_id: templateId,
        venue_id: venueId,
        name: section.name,
        guidance: section.guidance ?? null,
        sort_order: sectionByName.size,
      }).select("id").single<{ id: string }>();
      if (sErr) throw sErr;
      sectionId = created.id;
      sectionByName.set(section.name, sectionId);
    }
    const beforeLines = linesAdded;
    await insertSectionOfferings(client, venueId, templateId, sectionId, section.offerings ?? []);
    linesAdded += (section.offerings ?? []).length;
    void beforeLines;
    const nextGroupOrder = await insertSectionChoiceGroups(
      client, venueId, templateId, sectionId, section.choiceGroups ?? [], groupOrder, optionIdsByLabel,
    );
    groupsAdded += (section.choiceGroups ?? []).length;
    groupOrder = nextGroupOrder;
  }
  return { repaired: linesAdded > 0 || groupsAdded > 0, linesAdded, groupsAdded };
}

/**
 * Upgrade an uncustomized legacy flat starter (zero groups, exact legacy line
 * names) to the corrected included-lines + choice-groups structure. Idempotent:
 * skips when groups already exist or lines no longer match the legacy fingerprint.
 * Does not touch event orders or customized templates.
 */
export async function upgradeUncustomizedLegacyFlatStarter(
  client: DbClient,
  venueId: string,
  templateId: string,
): Promise<{ upgraded: boolean; reason: string }> {
  const { data: header } = await client.from("event_order_templates")
    .select("id, source_master_key, is_archived")
    .eq("id", templateId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string; source_master_key: string | null; is_archived: boolean }>();
  if (!header?.source_master_key) return { upgraded: false, reason: "no_master_key" };
  if (header.is_archived) return { upgraded: false, reason: "archived" };
  const master = getEventOrderStarterMaster(header.source_master_key);
  if (!master) return { upgraded: false, reason: "unknown_master" };

  const { count: groupCount } = await client.from("event_order_template_groups")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  if ((groupCount ?? 0) > 0) return { upgraded: false, reason: "already_has_groups" };

  const { data: lines } = await client.from("event_order_template_lines")
    .select("id, description")
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  const lineDescriptions = (lines ?? []).map((l: { description: string }) => l.description);
  if (!isUncustomizedLegacyFlatStarter(header.source_master_key, lineDescriptions, 0)) {
    return { upgraded: false, reason: "customized_or_mismatch" };
  }

  // Replace sections + lines with the corrected master structure.
  const { error: delOpt } = await client.from("event_order_template_options")
    .delete().eq("template_id", templateId).eq("venue_id", venueId);
  if (delOpt) throw delOpt;
  const { error: delGrp } = await client.from("event_order_template_groups")
    .delete().eq("template_id", templateId).eq("venue_id", venueId);
  if (delGrp) throw delGrp;
  const { error: delLines } = await client.from("event_order_template_lines")
    .delete().eq("template_id", templateId).eq("venue_id", venueId);
  if (delLines) throw delLines;
  const { error: delSecs } = await client.from("event_order_template_sections")
    .delete().eq("template_id", templateId).eq("venue_id", venueId);
  if (delSecs) throw delSecs;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("event_order_templates") as any)
    .update({ description: master.description, name: master.name })
    .eq("id", templateId)
    .eq("venue_id", venueId);

  let sectionOrder = 0;
  let groupOrder = 0;
  const optionIdsByLabel = new Map<string, string>();
  for (const section of master.sections) {
    const { data: sectionRow, error: sErr } = await client.from("event_order_template_sections").insert({
      template_id: templateId,
      venue_id: venueId,
      name: section.name,
      guidance: section.guidance ?? null,
      sort_order: sectionOrder,
    }).select("id").single<{ id: string }>();
    if (sErr) throw sErr;
    await insertSectionOfferings(client, venueId, templateId, sectionRow.id, section.offerings ?? []);
    groupOrder = await insertSectionChoiceGroups(
      client, venueId, templateId, sectionRow.id, section.choiceGroups ?? [], groupOrder, optionIdsByLabel,
    );
    sectionOrder += 1;
  }

  return { upgraded: true, reason: "upgraded" };
}

/**
 * Additive: for uncustomized delivery starters that already have Dinner/Bar
 * parent groups, insert missing empty dependent groups with depends_on wired.
 * Never deletes, never mutates existing groups/options, never invents menu items.
 */
export async function ensureConditionalChoiceScaffolding(
  client: DbClient,
  venueId: string,
  templateId: string,
): Promise<{ added: number }> {
  const { data: header } = await client.from("event_order_templates")
    .select("id, source_master_key, is_archived")
    .eq("id", templateId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string; source_master_key: string | null; is_archived: boolean }>();
  if (!header?.source_master_key || header.is_archived) return { added: 0 };
  const master = getEventOrderStarterMaster(header.source_master_key);
  if (!master) return { added: 0 };

  const { data: existingGroups } = await client.from("event_order_template_groups")
    .select("id, name, section_id, sort_order")
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  const groupsByName = new Map(
    (existingGroups ?? []).map((g: { id: string; name: string; section_id: string | null; sort_order: number }) => [
      g.name, g,
    ]),
  );

  const { data: existingOptions } = await client.from("event_order_template_options")
    .select("id, label, group_id")
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  const optionIdsByLabel = new Map<string, string>();
  for (const opt of existingOptions ?? []) {
    const label = String((opt as { label: string }).label).trim();
    if (!optionIdsByLabel.has(label)) {
      optionIdsByLabel.set(label, (opt as { id: string }).id);
    }
  }

  const { data: sections } = await client.from("event_order_template_sections")
    .select("id, name")
    .eq("template_id", templateId)
    .eq("venue_id", venueId);
  const sectionByName = new Map(
    (sections ?? []).map((s: { id: string; name: string }) => [s.name, s.id]),
  );

  let maxSort = Math.max(0, ...(existingGroups ?? []).map((g: { sort_order: number }) => g.sort_order));
  let added = 0;

  for (const section of master.sections) {
    const sectionId = sectionByName.get(section.name);
    if (!sectionId) continue;
    for (const group of section.choiceGroups ?? []) {
      if (!group.dependsOnOptionNames?.length) continue;
      if (groupsByName.has(group.name)) continue;
      const dependsOn = group.dependsOnOptionNames
        .map((label) => optionIdsByLabel.get(label.trim()))
        .filter((id): id is string => typeof id === "string");
      // Parent options must already exist — otherwise this template is customized
      // or incomplete; skip rather than invent parents.
      if (dependsOn.length !== group.dependsOnOptionNames.length) continue;

      maxSort += 1;
      const { data: groupRow, error: gErr } = await client.from("event_order_template_groups").insert({
        template_id: templateId,
        venue_id: venueId,
        section_id: sectionId,
        name: group.name,
        instructions: group.instructions ?? null,
        selection_mode: group.selectionMode,
        min_select: group.minSelect,
        max_select: group.maxSelect,
        allow_quantity: group.allowQuantity ?? false,
        depends_on_option_ids: dependsOn,
        sort_order: maxSort,
      }).select("id").single<{ id: string }>();
      if (gErr) throw gErr;
      groupsByName.set(group.name, {
        id: groupRow.id, name: group.name, section_id: sectionId, sort_order: maxSort,
      });
      // Honest empty: no fabricated options.
      added += 1;
    }
  }
  return { added };
}

/**
 * Called from apply/heal paths so Sandbox venues pick up corrected commercial
 * structure without a one-off SQL edit. Safe no-op for customized templates.
 */
export async function ensureStarterCommercialStructure(
  client: DbClient,
  venueId: string,
  templateId: string,
): Promise<{ repaired: boolean; upgraded: boolean; conditionalAdded: number }> {
  const repaired = await repairEmptyDeliveryStarterOfferings(client, venueId, templateId);
  if (repaired.repaired) {
    const conditional = await ensureConditionalChoiceScaffolding(client, venueId, templateId);
    return { repaired: true, upgraded: false, conditionalAdded: conditional.added };
  }
  const upgraded = await upgradeUncustomizedLegacyFlatStarter(client, venueId, templateId);
  const conditional = await ensureConditionalChoiceScaffolding(client, venueId, templateId);
  return {
    repaired: false,
    upgraded: upgraded.upgraded,
    conditionalAdded: conditional.added,
  };
}

export async function provisionEventOrderStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[]; repaired: string[]; upgraded: string[] }> {
  await archiveLegacyChecklistTemplates(client, venueId);

  const created: string[] = [];
  const skipped: string[] = [];
  const repaired: string[] = [];
  const upgraded: string[] = [];

  for (const master of EVENT_ORDER_STARTER_MASTERS) {
    const { data: byKey } = await client.from("event_order_templates")
      .select("id").eq("venue_id", venueId).eq("source_master_key", master.key).limit(1).maybeSingle();
    if (byKey) {
      const result = await ensureStarterCommercialStructure(client, venueId, byKey.id);
      if (result.upgraded) upgraded.push(master.key);
      else if (result.repaired) repaired.push(master.key);
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
  return { created, skipped, repaired, upgraded };
}

export async function seedEventOrderStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionEventOrderStarters(createAdminClient(), venueId);
}

export async function ensureEventOrderStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; repaired: string[]; upgraded: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) {
    return { ok: false, created: [], skipped: [], repaired: [], upgraded: [], message: "Backend not configured." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], repaired: [], upgraded: [], message: "No venue found." };
  try {
    const result = await provisionEventOrderStarters(await createClient(), venue.id);
    return { ok: true, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not ensure event order starters.";
    console.error("[ensureEventOrderStartersForCurrentVenue]", message);
    return { ok: false, created: [], skipped: [], repaired: [], upgraded: [], message };
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
