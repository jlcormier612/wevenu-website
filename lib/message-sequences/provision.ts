/**
 * Provision Hello to Cheers starter Automations into a venue.
 *
 * Masters are code fixtures (starters.ts). Venue copies are independent.
 * Re-copy never overwrites a customized earlier copy.
 * Depends on Message Template starters (MSG-01) already being provisioned.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getTemplateByMasterKey } from "@/lib/message-templates/repository";
import { provisionStarterMessageTemplates } from "@/lib/message-templates/provision";
import {
  STARTER_SEQUENCE_MASTERS,
  type StarterSequenceMaster,
  type StarterSequenceMasterKey,
} from "@/lib/message-sequences/starters";
import type { MessageSequenceInput } from "@/lib/message-sequences/types";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertStarterSequence(
  client: DbClient,
  venueId: string,
  master: StarterSequenceMaster,
  input: MessageSequenceInput,
): Promise<string> {
  const { data, error } = await client.from("message_sequences")
    .insert({
      venue_id: venueId,
      name: input.name.trim(),
      trigger_type: input.triggerType,
      trigger_stage: input.triggerType === "lead_stage_changed" ? input.triggerStage : null,
      source_master_key: master.key,
      status: "active",
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;

  await client.from("sequence_steps").insert(
    input.steps.map((s, i) => ({
      venue_id: venueId,
      sequence_id: data.id,
      template_id: s.templateId,
      channel: s.channel,
      sort_order: i,
      offset_days: s.offsetDays,
    })),
  );
  return data.id;
}

async function buildInputFromMaster(
  client: DbClient,
  venueId: string,
  master: StarterSequenceMaster,
): Promise<MessageSequenceInput | null> {
  const steps: MessageSequenceInput["steps"] = [];
  for (const step of master.steps) {
    const template = await getTemplateByMasterKey(client, venueId, step.templateMasterKey);
    if (!template) return null;
    steps.push({
      templateId: template.id,
      channel: step.channel,
      offsetDays: step.offsetDays,
    });
  }
  return {
    name: master.name,
    triggerType: master.triggerType,
    triggerStage: master.triggerStage,
    steps,
  };
}

/**
 * Idempotent: for each master, ensure the venue has a tagged Automation —
 * or skip when a same-named Automation already exists (preserve customization).
 */
export async function provisionStarterAutomations(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[]; blocked: string[] }> {
  // Ensure message template masters exist so step template_ids resolve.
  await provisionStarterMessageTemplates(client, venueId);

  const created: string[] = [];
  const skipped: string[] = [];
  const blocked: string[] = [];

  for (const master of STARTER_SEQUENCE_MASTERS) {
    const { data: byKey } = await client.from("message_sequences")
      .select("id")
      .eq("venue_id", venueId)
      .eq("source_master_key", master.key)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (byKey) {
      skipped.push(master.key);
      continue;
    }

    const { data: sameName } = await client.from("message_sequences")
      .select("id")
      .eq("venue_id", venueId)
      .eq("name", master.name)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (sameName) {
      skipped.push(master.key);
      continue;
    }

    const input = await buildInputFromMaster(client, venueId, master);
    if (!input) {
      blocked.push(master.key);
      continue;
    }

    await insertStarterSequence(client, venueId, master, input);
    created.push(master.key);
  }

  return { created, skipped, blocked };
}

/** Called at venue creation — admin client so RLS never blocks seed. */
export async function seedStarterAutomations(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const admin = createAdminClient();
  await provisionStarterAutomations(admin, venueId);
}

/** Session-scoped ensure for Automations page / existing venues. */
export async function ensureStarterAutomationsForCurrentVenue(): Promise<{
  ok: boolean;
  created: string[];
  skipped: string[];
  blocked: string[];
  message?: string;
}> {
  if (!isSupabaseConfigured) {
    return { ok: false, created: [], skipped: [], blocked: [], message: "Backend not configured." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], blocked: [], message: "No venue found." };
  const supabase = await createClient();
  const result = await provisionStarterAutomations(supabase, venue.id);
  return { ok: true, ...result };
}

export async function listMissingStarterSequenceKeysForCurrentVenue(): Promise<StarterSequenceMasterKey[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const missing: StarterSequenceMasterKey[] = [];
  for (const master of STARTER_SEQUENCE_MASTERS) {
    const { data } = await supabase.from("message_sequences")
      .select("id")
      .eq("venue_id", venue.id)
      .eq("source_master_key", master.key)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!data) missing.push(master.key);
  }
  return missing;
}
