/**
 * Provision Hello to Cheers FAQ starters (FAQ-01 … FAQ-12) into a venue's
 * Venue Guide. Masters are code fixtures — never editable DB rows.
 * Venue copies are independent jsonb entries; provision never overwrites customs.
 * Starters seed unpublished (published: false).
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { GuideFaqEntry } from "@/lib/venue-guide/audience";
import {
  FAQ_STARTER_MASTERS,
  faqEntryFromMaster,
  getFaqStarterMaster,
  shouldSkipFaqStarterProvision,
  type FaqStarterMasterKey,
} from "@/lib/venue-guide/starters";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

function asFaqList(raw: unknown): GuideFaqEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is GuideFaqEntry => !!f && typeof f === "object" && !Array.isArray(f));
}

function existingKeys(faqs: GuideFaqEntry[]): Set<string> {
  const keys = new Set<string>();
  for (const f of faqs) {
    if (typeof f.source_master_key === "string" && f.source_master_key.trim()) {
      keys.add(f.source_master_key);
    }
  }
  return keys;
}

function existingQuestions(faqs: GuideFaqEntry[]): Set<string> {
  return new Set(
    faqs
      .map((f) => (typeof f.question === "string" ? f.question : ""))
      .filter((q) => q.trim().length > 0),
  );
}

async function loadVenueFaqs(client: DbClient, venueId: string): Promise<GuideFaqEntry[]> {
  const { data, error } = await client
    .from("venue_operational_info")
    .select("faqs")
    .eq("venue_id", venueId)
    .maybeSingle<{ faqs: unknown }>();
  if (error) throw error;
  return asFaqList(data?.faqs);
}

async function writeVenueFaqs(client: DbClient, venueId: string, faqs: GuideFaqEntry[]): Promise<void> {
  const { error } = await client.from("venue_operational_info").upsert(
    {
      venue_id: venueId,
      faqs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id" },
  );
  if (error) throw error;
}

export async function provisionFaqStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const faqs = await loadVenueFaqs(client, venueId);
  const byKey = existingKeys(faqs);
  const byQuestion = existingQuestions(faqs);
  let changed = false;

  for (const master of FAQ_STARTER_MASTERS) {
    const decision = shouldSkipFaqStarterProvision({
      masterKey: master.key,
      masterQuestion: master.question,
      existingByKey: byKey,
      existingQuestions: byQuestion,
    });
    if (decision !== "create") {
      skipped.push(master.key);
      continue;
    }
    faqs.push(faqEntryFromMaster(master));
    byKey.add(master.key);
    byQuestion.add(master.question);
    created.push(master.key);
    changed = true;
  }

  if (changed) {
    await writeVenueFaqs(client, venueId, faqs);
  }
  return { created, skipped };
}

export async function seedFaqStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionFaqStarters(createAdminClient(), venueId);
}

export async function ensureFaqStartersForCurrentVenue(): Promise<{
  ok: boolean;
  created: string[];
  skipped: string[];
  message?: string;
}> {
  if (!isSupabaseConfigured) {
    return { ok: false, created: [], skipped: [], message: "Backend not configured." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], skipped: [], message: "No venue found." };
  const result = await provisionFaqStarters(await createClient(), venue.id);
  return { ok: true, ...result };
}

export async function addFaqStarterAgain(
  masterKey: FaqStarterMasterKey,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getFaqStarterMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const client = await createClient();

  const faqs = await loadVenueFaqs(client, venue.id);
  if (existingKeys(faqs).has(master.key)) {
    return {
      ok: false,
      message:
        "This starter is already in your Venue Guide. Delete it first to restore a fresh copy, or edit it to customize further.",
    };
  }

  const byQuestion = existingQuestions(faqs);
  let question = master.question;
  if (byQuestion.has(question)) {
    question = `${master.question} (Starter)`;
    let n = 2;
    while (byQuestion.has(question)) {
      question = `${master.question} (Starter ${n})`;
      n += 1;
    }
  }

  try {
    const entry = faqEntryFromMaster(master);
    faqs.push({ ...entry, question });
    await writeVenueFaqs(client, venue.id, faqs);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add starter." };
  }
}
