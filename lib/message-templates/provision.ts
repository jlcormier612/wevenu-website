/**
 * Provision Hello to Cheers starter Message Templates into a venue's Library.
 *
 * Masters are code fixtures (starters.ts). Venue copies are independent.
 * Re-copy never overwrites a customized earlier copy.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/message-templates/repository";
import {
  STARTER_MESSAGE_MASTERS,
  getStarterMessageMaster,
  masterContentFingerprint,
  type StarterMessageMasterKey,
} from "@/lib/message-templates/starters";
import type { CreateMessageTemplateResult, MessageTemplateActionResult } from "@/lib/message-templates/types";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

function masterInput(master: (typeof STARTER_MESSAGE_MASTERS)[number]) {
  return {
    name: master.name,
    category: master.category,
    emailSubject: master.emailSubject,
    emailBody: master.emailBody,
    smsBody: master.smsBody,
  };
}

/**
 * Idempotent: for each master, ensure the venue has a tagged copy — or an
 * exact-match untagged template adopted — without overwriting customized work.
 */
export async function provisionStarterMessageTemplates(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; adopted: string[]; skipped: string[] }> {
  const created: string[] = [];
  const adopted: string[] = [];
  const skipped: string[] = [];

  for (const master of STARTER_MESSAGE_MASTERS) {
    const existingByKey = await repo.getTemplateByMasterKey(client, venueId, master.key);
    if (existingByKey) {
      skipped.push(master.key);
      continue;
    }

    const sameName = await repo.getTemplatesByName(client, venueId, master.name);
    const exact = sameName.find((t) =>
      masterContentFingerprint({
        name: t.name,
        category: t.category,
        emailSubject: t.emailSubject ?? "",
        emailBody: t.emailBody ?? "",
        smsBody: t.smsBody ?? "",
      }) === masterContentFingerprint(master),
    );

    if (exact) {
      await repo.adoptSourceMasterKey(client, venueId, exact.id, master.key);
      adopted.push(master.key);
      continue;
    }

    if (sameName.length > 0) {
      // Venue already has a same-named (likely customized) template — do not
      // duplicate or overwrite. They can use "Add starter again" deliberately.
      skipped.push(master.key);
      continue;
    }

    await repo.insertTemplate(client, venueId, masterInput(master), { sourceMasterKey: master.key });
    created.push(master.key);
  }

  return { created, adopted, skipped };
}

/** Called at venue creation — admin client so RLS never blocks seed. */
export async function seedStarterMessageTemplates(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const admin = createAdminClient();
  await provisionStarterMessageTemplates(admin, venueId);
}

/** Session-scoped ensure for Library page / existing venues. */
export async function ensureStarterMessageTemplatesForCurrentVenue(): Promise<{
  ok: boolean;
  created: string[];
  adopted: string[];
  skipped: string[];
  message?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, created: [], adopted: [], skipped: [], message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, created: [], adopted: [], skipped: [], message: "No venue found." };
  const supabase = await createClient();
  const result = await provisionStarterMessageTemplates(supabase, venue.id);
  return { ok: true, ...result };
}

/**
 * Always inserts a fresh copy of the master. Never updates an existing row —
 * customized MSG-01 stays; this creates "New Inquiry Response (Starter)".
 */
export async function addStarterMessageAgain(masterKey: StarterMessageMasterKey): Promise<CreateMessageTemplateResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const master = getStarterMessageMaster(masterKey);
  if (!master) return { ok: false, message: "Unknown starter." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const name = await repo.uniqueTemplateName(supabase, venue.id, master.name);
  const templateId = await repo.insertTemplate(
    supabase,
    venue.id,
    { ...masterInput(master), name },
    { sourceMasterKey: master.key },
  );
  return { ok: true, templateId };
}

export async function listMissingStarterKeysForCurrentVenue(): Promise<StarterMessageMasterKey[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const missing: StarterMessageMasterKey[] = [];
  for (const master of STARTER_MESSAGE_MASTERS) {
    const existing = await repo.getTemplateByMasterKey(supabase, venue.id, master.key);
    if (!existing) missing.push(master.key);
  }
  return missing;
}

/** Force-provision missing keys even when a same-named customized template exists. */
export async function provisionMissingStartersIgnoringNameCollision(): Promise<MessageTemplateActionResult & { created?: string[] }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const created: string[] = [];
  for (const master of STARTER_MESSAGE_MASTERS) {
    const existing = await repo.getTemplateByMasterKey(supabase, venue.id, master.key);
    if (existing) continue;
    const name = await repo.uniqueTemplateName(supabase, venue.id, master.name);
    await repo.insertTemplate(supabase, venue.id, { ...masterInput(master), name }, { sourceMasterKey: master.key });
    created.push(master.key);
  }
  return { ok: true, created };
}
