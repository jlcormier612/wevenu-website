/**
 * Provision Standard Wedding — Client Planning into a venue Library,
 * matching Contract Template starter behavior: a real playbook_templates row
 * at workspace seed time, not a virtual "Use this starter" overlay.
 *
 * Venue Planning is not seeded. Setup Profile continues to list active
 * kind=client templates only.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  STANDARD_CLIENT_PLANNING_MILESTONES,
  STANDARD_CLIENT_PLANNING_TASKS,
} from "@/lib/playbooks/constants";
import * as repo from "@/lib/playbooks/repository";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export const CLIENT_PLANNING_STARTER_NAME = "Standard Wedding — Client Planning";
export const CLIENT_PLANNING_STARTER_KEY = "PB-CLIENT-01";
export const CLIENT_PLANNING_STARTER_DESCRIPTION =
  "Guides your client through their own to-dos after booking, through post-event.";

export function shouldSkipClientPlanningStarterProvision(input: {
  hasPbClient01: boolean;
  hasActiveClientTemplate: boolean;
  hasSameName: boolean;
}): boolean {
  return input.hasPbClient01 || input.hasActiveClientTemplate || input.hasSameName;
}

export async function provisionClientPlanningStarter(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const { data: existing } = await client
    .from("playbook_templates")
    .select("id, name, kind, is_archived, source_master_key, is_default, event_type")
    .eq("venue_id", venueId);

  const rows = existing ?? [];
  const skip = shouldSkipClientPlanningStarterProvision({
    hasPbClient01: rows.some((r) => r.source_master_key === CLIENT_PLANNING_STARTER_KEY),
    hasActiveClientTemplate: rows.some((r) => r.kind === "client" && r.is_archived === false),
    hasSameName: rows.some((r) => r.name === CLIENT_PLANNING_STARTER_NAME),
  });
  if (skip) {
    return { created: [], skipped: [CLIENT_PLANNING_STARTER_KEY] };
  }

  const hasClientWeddingDefault = rows.some(
    (r) =>
      r.kind === "client" &&
      r.event_type === "wedding" &&
      r.is_default === true &&
      r.is_archived === false,
  );

  const templateId = await repo.insertTemplate(
    client,
    venueId,
    CLIENT_PLANNING_STARTER_NAME,
    "client",
    "wedding",
    CLIENT_PLANNING_STARTER_DESCRIPTION,
    {
      sourceMasterKey: CLIENT_PLANNING_STARTER_KEY,
      isDefault: !hasClientWeddingDefault,
    },
  );
  const milestoneIds: string[] = [];
  for (let i = 0; i < STANDARD_CLIENT_PLANNING_MILESTONES.length; i++) {
    const m = STANDARD_CLIENT_PLANNING_MILESTONES[i];
    milestoneIds.push(
      await repo.insertMilestone(client, venueId, templateId, m.name, i, m.kind ?? undefined),
    );
  }
  for (const { milestoneIndex, ...task } of STANDARD_CLIENT_PLANNING_TASKS) {
    await repo.insertTemplateTask(client, venueId, templateId, {
      ...task,
      milestoneId: milestoneIds[milestoneIndex],
    });
  }
  return { created: [CLIENT_PLANNING_STARTER_KEY], skipped: [] };
}

export async function seedPlaybookStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionClientPlanningStarter(createAdminClient(), venueId);
}
