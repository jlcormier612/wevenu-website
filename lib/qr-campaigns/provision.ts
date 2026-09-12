/**
 * Provision Hello to Cheers QR Campaign starters (QR-01..QR-03).
 * Persistent master keys — starters remain available to add again.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  QR_STARTER_MASTERS,
  getQrStarterMaster,
  type QrStarterMaster,
  type QrStarterMasterKey,
} from "@/lib/qr-campaigns/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function insertStarterFromMaster(
  client: DbClient,
  venueId: string,
  master: QrStarterMaster,
  name: string,
): Promise<string> {
  const { data, error } = await client.from("qr_campaigns").insert({
    venue_id: venueId,
    name,
    destination_type: master.destinationType,
    source_master_key: master.key,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function provisionQrStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const { data: byKeyRows } = await client
    .from("qr_campaigns")
    .select("source_master_key")
    .eq("venue_id", venueId)
    .not("source_master_key", "is", null);
  const existingByKey = new Set(
    (byKeyRows ?? [])
      .map((r: { source_master_key: string | null }) => r.source_master_key)
      .filter((k): k is string => Boolean(k)),
  );

  for (const master of QR_STARTER_MASTERS) {
    if (existingByKey.has(master.key)) {
      skipped.push(master.key);
      continue;
    }
    await insertStarterFromMaster(client, venueId, master, master.name);
    existingByKey.add(master.key);
    created.push(master.key);
  }
  return { created, skipped };
}

export async function ensureQrStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const result = await provisionQrStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addQrStarterAgain(
  masterKey: QrStarterMasterKey,
): Promise<{ ok: true; campaignId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const master = getQrStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const client = await createClient();
  const { data: existing } = await client
    .from("qr_campaigns")
    .select("id")
    .eq("venue_id", venue.id)
    .eq("source_master_key", masterKey)
    .maybeSingle<{ id: string }>();
  if (existing) {
    // Create a venue copy without the unique master key (add-again semantics).
    const { data, error } = await client.from("qr_campaigns").insert({
      venue_id: venue.id,
      name: `${master.name} (Copy)`,
      destination_type: master.destinationType,
      source_master_key: null,
    }).select("id").single<{ id: string }>();
    if (error || !data) return { ok: false, message: "Could not add starter again." };
    return { ok: true, campaignId: data.id };
  }
  try {
    const campaignId = await insertStarterFromMaster(client, venue.id, master, master.name);
    return { ok: true, campaignId };
  } catch {
    return { ok: false, message: "Could not create starter." };
  }
}
