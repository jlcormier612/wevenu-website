/**
 * Provision Hello to Cheers Questionnaire Family starters into a venue Library.
 * Masters are code fixtures — never editable DB rows.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  QUESTIONNAIRE_FAMILY_MASTERS,
  getQuestionnaireMaster,
  masterIncludedFieldIds,
  masterRequiredFieldIds,
  type QuestionnaireFamilyMaster,
} from "@/lib/questionnaire-family/definitions";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertMasterCopy(client: DbClient, venueId: string, master: QuestionnaireFamilyMaster, name: string) {
  const { error } = await client.from("questionnaire_templates").insert({
    venue_id: venueId,
    name,
    description: master.description,
    kind: master.kind,
    source_master_key: master.key,
    included_fields: masterIncludedFieldIds(master),
    required_fields: masterRequiredFieldIds(master),
  });
  if (error) throw error;
}

export async function provisionQuestionnaireFamily(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  for (const master of QUESTIONNAIRE_FAMILY_MASTERS) {
    const { data: byKey } = await client.from("questionnaire_templates")
      .select("id").eq("venue_id", venueId).eq("source_master_key", master.key).limit(1).maybeSingle();
    if (byKey) {
      skipped.push(master.key);
      continue;
    }

    const { data: sameName } = await client.from("questionnaire_templates")
      .select("id, description, kind")
      .eq("venue_id", venueId).eq("name", master.name).limit(1).maybeSingle();

    if (sameName) {
      // Preserve customized / pre-existing same-named templates. Do not overwrite.
      skipped.push(master.key);
      continue;
    }

    await insertMasterCopy(client, venueId, master, master.name);
    created.push(master.key);
  }
  return { created, skipped };
}

export async function seedQuestionnaireFamily(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionQuestionnaireFamily(createAdminClient(), venueId);
}

export async function ensureQuestionnaireFamilyForCurrentVenue(): Promise<{ ok: boolean; created: string[]; skipped: string[]; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const result = await provisionQuestionnaireFamily(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addQuestionnaireStarterAgain(masterKey: "QST-CP" | "QST-FD" | "QST-PE"): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getQuestionnaireMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const { data: existing } = await client.from("questionnaire_templates")
    .select("name").eq("venue_id", venue.id);
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

  const { data, error } = await client.from("questionnaire_templates").insert({
    venue_id: venue.id,
    name,
    description: master.description,
    kind: master.kind,
    source_master_key: master.key,
    included_fields: masterIncludedFieldIds(master),
    required_fields: masterRequiredFieldIds(master),
  }).select("id").single<{ id: string }>();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not add starter." };
  return { ok: true, templateId: data.id };
}

export async function provisionMissingQuestionnaireStarters(): Promise<{ ok: boolean; created?: string[]; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();
  const created: string[] = [];
  for (const master of QUESTIONNAIRE_FAMILY_MASTERS) {
    const { data: byKey } = await client.from("questionnaire_templates")
      .select("id").eq("venue_id", venue.id).eq("source_master_key", master.key).limit(1).maybeSingle();
    if (byKey) continue;
    const result = await addQuestionnaireStarterAgain(master.key);
    if (result.ok) created.push(master.key);
  }
  return { ok: true, created };
}
