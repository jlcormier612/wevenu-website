/**
 * Provision Wedding Venue Agreement starter into a venue Library.
 * Masters are code fixtures — never editable DB rows.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { REMOVED_MERGE_FIELD_KEYS } from "@/lib/contracts/constants";
import {
  CONTRACT_STARTER_MASTERS,
  getContractStarterMaster,
  type ContractStarterMasterKey,
} from "@/lib/contracts/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

/** Booking-backed tokens the CTR-01 master must contain after the 22f09ea4 restore. */
export const REQUIRED_CTR01_SMART_FIELDS = [
  "event_spaces",
  "package_section",
  "included_items_summary",
  "additional_items_summary",
  "payment_schedule_summary",
  "contract_total",
  "balance_remaining",
] as const;

/** True when template content still advertises removed Smart Field tokens. */
export function starterContentHasRemovedSmartFields(content: string): boolean {
  return REMOVED_MERGE_FIELD_KEYS.some((key) => content.includes(`{{${key}}}`));
}

/** True when a system CTR-01 row is still the stripped 078 / 22f09ea4 body. */
export function starterContentNeedsSupportedSmartFieldRestore(content: string): boolean {
  return REQUIRED_CTR01_SMART_FIELDS.some((key) => !content.includes(`{{${key}}}`));
}

export function starterContentShouldRefreshFromMaster(content: string): boolean {
  return starterContentHasRemovedSmartFields(content) || starterContentNeedsSupportedSmartFieldRestore(content);
}

async function insertStarter(client: DbClient, venueId: string, name: string, description: string, content: string, sourceMasterKey: string, isDefault: boolean) {
  if (isDefault) {
    await client.from("contract_templates").update({ is_default: false }).eq("venue_id", venueId);
  }
  const { data, error } = await client.from("contract_templates").insert({
    venue_id: venueId,
    name,
    description,
    content,
    is_default: isDefault,
    source_master_key: sourceMasterKey,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function provisionContractStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[]; refreshed: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const refreshed: string[] = [];

  for (const master of CONTRACT_STARTER_MASTERS) {
    const { data: byKey } = await client.from("contract_templates")
      .select("id, content").eq("venue_id", venueId).eq("source_master_key", master.key).limit(1).maybeSingle();
    if (byKey) {
      // System starter still stripped (078) or still has removed tokens → refresh from master.
      // Does not touch customer-authored templates (source_master_key null).
      if (starterContentShouldRefreshFromMaster(byKey.content ?? "")) {
        const { error } = await client
          .from("contract_templates")
          .update({ content: master.content })
          .eq("id", byKey.id)
          .eq("venue_id", venueId)
          .eq("source_master_key", master.key);
        if (error) throw error;
        refreshed.push(master.key);
      } else {
        skipped.push(master.key);
      }
      continue;
    }

    const { data: sameName } = await client.from("contract_templates")
      .select("id").eq("venue_id", venueId).eq("name", master.name).limit(1).maybeSingle();
    if (sameName) {
      // Preserve customized / pre-existing same-named templates.
      skipped.push(master.key);
      continue;
    }

    const { count } = await client.from("contract_templates")
      .select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("is_archived", false);
    const makeDefault = (count ?? 0) === 0 && master.isDefault;

    await insertStarter(client, venueId, master.name, master.description, master.content, master.key, makeDefault);
    created.push(master.key);
  }
  return { created, skipped, refreshed };
}

export async function seedContractStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionContractStarters(createAdminClient(), venueId);
}

export async function ensureContractStartersForCurrentVenue(): Promise<{
  ok: boolean; created: string[]; skipped: string[]; refreshed: string[]; message?: string;
}> {
  if (!isSupabaseConfigured) {
    return { ok: false, created: [], skipped: [], refreshed: [], message: "Backend not configured." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], refreshed: [], message: "No venue found." };
  const result = await provisionContractStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addContractStarterAgain(
  masterKey: ContractStarterMasterKey = "CTR-01",
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getContractStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const { data: existing } = await client.from("contract_templates").select("name").eq("venue_id", venue.id);
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
    const templateId = await insertStarter(
      client, venue.id, name, master.description, master.content, master.key, false,
    );
    return { ok: true, templateId };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add starter." };
  }
}
