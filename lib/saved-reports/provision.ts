/**
 * Provision Hello to Cheers Saved Report starters (Sales / Bookings / Revenue / Events).
 * Thin configs over existing report paths — no new metrics.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  SAVED_REPORT_STARTER_MASTERS,
  getSavedReportStarterMaster,
  shouldSkipSavedReportStarterProvision,
  type SavedReportStarterMaster,
  type SavedReportStarterMasterKey,
} from "@/lib/saved-reports/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertStarterFromMaster(
  client: DbClient,
  venueId: string,
  master: SavedReportStarterMaster,
  name: string,
  createdBy: string | null,
): Promise<string> {
  const { data, error } = await client.from("saved_reports").insert({
    venue_id: venueId,
    created_by: createdBy,
    name,
    report_path: master.reportPath,
    date_preset: master.datePreset,
    custom_from: null,
    custom_to: null,
    source_master_key: master.key,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function provisionSavedReportStarters(
  client: DbClient,
  venueId: string,
  createdBy: string | null = null,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const [{ data: byKeyRows }, { data: nameRows }] = await Promise.all([
    client.from("saved_reports").select("source_master_key").eq("venue_id", venueId).not("source_master_key", "is", null),
    client.from("saved_reports").select("name").eq("venue_id", venueId),
  ]);
  const existingByKey = new Set(
    (byKeyRows ?? [])
      .map((r: { source_master_key: string | null }) => r.source_master_key)
      .filter((k): k is string => Boolean(k)),
  );
  const existingNames = new Set((nameRows ?? []).map((r: { name: string }) => r.name));

  for (const master of SAVED_REPORT_STARTER_MASTERS) {
    const decision = shouldSkipSavedReportStarterProvision({
      masterKey: master.key,
      masterName: master.name,
      existingByKey,
      existingNames,
    });
    if (decision !== "create") {
      skipped.push(master.key);
      continue;
    }
    await insertStarterFromMaster(client, venueId, master, master.name, createdBy);
    existingByKey.add(master.key);
    existingNames.add(master.name);
    created.push(master.key);
  }
  return { created, skipped };
}

export async function seedSavedReportStarters(venueId: string, createdBy?: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionSavedReportStarters(createAdminClient(), venueId, createdBy ?? null);
}

export async function ensureSavedReportStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const result = await provisionSavedReportStarters(client, venue.id, user?.id ?? null);
  return { ok: true, ...result };
}

export async function addSavedReportStarterAgain(
  masterKey: SavedReportStarterMasterKey,
): Promise<{ ok: true; savedReportId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getSavedReportStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();

  const { data: byKey } = await client.from("saved_reports")
    .select("id").eq("venue_id", venue.id).eq("source_master_key", master.key).limit(1).maybeSingle();
  if (byKey) {
    return {
      ok: false,
      message: "This starter is already in your Library. Delete it first to restore a fresh copy, or duplicate it to customize further.",
    };
  }

  const { data: existing } = await client.from("saved_reports").select("name").eq("venue_id", venue.id);
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
    const savedReportId = await insertStarterFromMaster(client, venue.id, master, name, user?.id ?? null);
    return { ok: true, savedReportId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add starter." };
  }
}
