/**
 * Provision Standard Wedding Planning starters into a venue Library,
 * matching Contract Template starter behavior: real playbook_templates rows
 * at workspace seed time, not virtual "Use this starter" overlays.
 *
 * Seeds both Client (PB-CLIENT-01) and Venue (PB-VENUE-01) library rows.
 * Setup Profile continues to list active kind=client templates only.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  STANDARD_CLIENT_PLANNING_MILESTONES,
  STANDARD_CLIENT_PLANNING_TASKS,
  STANDARD_VENUE_WORKFLOW_MILESTONES,
  STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";
import * as repo from "@/lib/playbooks/repository";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export const CLIENT_PLANNING_STARTER_NAME = "Standard Wedding — Client Planning";
export const CLIENT_PLANNING_STARTER_KEY = "PB-CLIENT-01";
export const CLIENT_PLANNING_STARTER_DESCRIPTION =
  "Guides your client through their own to-dos after booking, through post-event.";

export const VENUE_PLANNING_STARTER_NAME = "Standard Wedding — Venue Planning";
export const VENUE_PLANNING_STARTER_KEY = "PB-VENUE-01";
export const VENUE_PLANNING_STARTER_DESCRIPTION =
  "Runs your team's internal checklist for a booked event, from planning through post-event.";

export function shouldSkipClientPlanningStarterProvision(input: {
  hasPbClient01: boolean;
  hasActiveClientTemplate: boolean;
  hasSameName: boolean;
}): boolean {
  return input.hasPbClient01 || input.hasActiveClientTemplate || input.hasSameName;
}

export function shouldSkipVenuePlanningStarterProvision(input: {
  hasPbVenue01: boolean;
  hasActiveVenueTemplate: boolean;
  hasSameName: boolean;
}): boolean {
  return input.hasPbVenue01 || input.hasActiveVenueTemplate || input.hasSameName;
}

async function seedTemplateTasks(
  client: DbClient,
  venueId: string,
  templateId: string,
  milestones: { name: string; kind: import("@/lib/playbooks/types").MilestoneKind | null }[],
  tasks: (Omit<
    import("@/lib/playbooks/types").PlaybookTask,
    "id" | "templateId" | "venueId" | "createdAt" | "milestoneId" | "needsReview"
  > & { milestoneIndex: number; needsReview?: boolean })[],
): Promise<void> {
  const milestoneIds: string[] = [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    milestoneIds.push(
      await repo.insertMilestone(client, venueId, templateId, m.name, i, m.kind ?? undefined),
    );
  }
  for (const { milestoneIndex, ...task } of tasks) {
    await repo.insertTemplateTask(client, venueId, templateId, {
      ...task,
      milestoneId: milestoneIds[milestoneIndex],
    });
  }
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
  await seedTemplateTasks(
    client,
    venueId,
    templateId,
    STANDARD_CLIENT_PLANNING_MILESTONES,
    STANDARD_CLIENT_PLANNING_TASKS,
  );
  return { created: [CLIENT_PLANNING_STARTER_KEY], skipped: [] };
}

export async function provisionVenuePlanningStarter(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const { data: existing } = await client
    .from("playbook_templates")
    .select("id, name, kind, is_archived, source_master_key, is_default, event_type")
    .eq("venue_id", venueId);

  const rows = existing ?? [];
  const skip = shouldSkipVenuePlanningStarterProvision({
    hasPbVenue01: rows.some((r) => r.source_master_key === VENUE_PLANNING_STARTER_KEY),
    hasActiveVenueTemplate: rows.some((r) => r.kind === "venue" && r.is_archived === false),
    hasSameName: rows.some((r) => r.name === VENUE_PLANNING_STARTER_NAME),
  });
  if (skip) {
    return { created: [], skipped: [VENUE_PLANNING_STARTER_KEY] };
  }

  const hasVenueWeddingDefault = rows.some(
    (r) =>
      r.kind === "venue" &&
      r.event_type === "wedding" &&
      r.is_default === true &&
      r.is_archived === false,
  );

  const templateId = await repo.insertTemplate(
    client,
    venueId,
    VENUE_PLANNING_STARTER_NAME,
    "venue",
    "wedding",
    VENUE_PLANNING_STARTER_DESCRIPTION,
    {
      sourceMasterKey: VENUE_PLANNING_STARTER_KEY,
      isDefault: !hasVenueWeddingDefault,
    },
  );
  await seedTemplateTasks(
    client,
    venueId,
    templateId,
    STANDARD_VENUE_WORKFLOW_MILESTONES,
    STANDARD_VENUE_WORKFLOW_TASKS,
  );
  return { created: [VENUE_PLANNING_STARTER_KEY], skipped: [] };
}

export async function seedPlaybookStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const admin = createAdminClient();
  await provisionClientPlanningStarter(admin, venueId);
  await provisionVenuePlanningStarter(admin, venueId);
}
