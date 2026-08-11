/**
 * Provision Hello to Cheers Brochure starter (BR-01).
 * Venue-owned copy; never overwrites customized brochures; zero financial side effects.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  BROCHURE_STARTER_MASTERS,
  getBrochureStarterMaster,
  shouldSkipBrochureStarterProvision,
  type BrochureStarterMaster,
  type BrochureStarterMasterKey,
} from "@/lib/brochures/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertStarterFromMaster(
  client: DbClient,
  venueId: string,
  master: BrochureStarterMaster,
  name: string,
): Promise<string> {
  const { data, error } = await client.from("brochures").insert({
    venue_id: venueId,
    name,
    welcome_text: master.welcomeText,
    include_packages: master.includePackages,
    include_faqs: master.includeFaqs,
    closing_text: master.closingText,
    source_master_key: master.key,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  const brochureId = data.id;
  await client.from("brochure_activities").insert({
    venue_id: venueId,
    brochure_id: brochureId,
    type: "created",
    title: "Hello to Cheers starter brochure added",
  });
  return brochureId;
}

export async function provisionBrochureStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const [{ data: byKeyRows }, { data: nameRows }] = await Promise.all([
    client.from("brochures").select("source_master_key").eq("venue_id", venueId).not("source_master_key", "is", null),
    client.from("brochures").select("name").eq("venue_id", venueId),
  ]);
  const existingByKey = new Set(
    (byKeyRows ?? [])
      .map((r: { source_master_key: string | null }) => r.source_master_key)
      .filter((k): k is string => Boolean(k)),
  );
  const existingNames = new Set((nameRows ?? []).map((r: { name: string }) => r.name));

  for (const master of BROCHURE_STARTER_MASTERS) {
    const decision = shouldSkipBrochureStarterProvision({
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

export async function seedBrochureStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionBrochureStarters(createAdminClient(), venueId);
}

export async function ensureBrochureStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const result = await provisionBrochureStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addBrochureStarterAgain(
  masterKey: BrochureStarterMasterKey = "BR-01",
): Promise<{ ok: true; brochureId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getBrochureStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const { data: byKey } = await client.from("brochures")
    .select("id").eq("venue_id", venue.id).eq("source_master_key", master.key).limit(1).maybeSingle();
  if (byKey) {
    return {
      ok: false,
      message: "This starter is already in your Library. Delete it first to restore a fresh copy, or duplicate it to customize further.",
    };
  }

  const { data: existing } = await client.from("brochures").select("name").eq("venue_id", venue.id);
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
    const brochureId = await insertStarterFromMaster(client, venue.id, master, name);
    return { ok: true, brochureId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add starter." };
  }
}
