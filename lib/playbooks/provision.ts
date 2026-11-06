/**
 * Provision Standard Wedding Planning starters into a venue Library,
 * matching Contract Template starter behavior: real playbook_templates rows
 * at workspace seed time, not virtual "Use this starter" overlays.
 *
 * Seeds wedding Client (PB-CLIENT-01) and Venue (PB-VENUE-01) library rows,
 * plus optional corporate / social planning starters (Library only — never
 * auto-assigned as Setup Profiles).
 *
 * Skip rules use stable source_master_key and same-name guards only.
 * Presence of any venue-authored playbook must not block platform starters.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CORPORATE_CLIENT_PLANNING_MILESTONES,
  CORPORATE_CLIENT_PLANNING_TASKS,
  CORPORATE_VENUE_WORKFLOW_MILESTONES,
  CORPORATE_VENUE_WORKFLOW_TASKS,
  SOCIAL_CLIENT_PLANNING_MILESTONES,
  SOCIAL_CLIENT_PLANNING_TASKS,
  SOCIAL_VENUE_WORKFLOW_MILESTONES,
  SOCIAL_VENUE_WORKFLOW_TASKS,
  STANDARD_CLIENT_PLANNING_MILESTONES,
  STANDARD_CLIENT_PLANNING_TASKS,
  STANDARD_VENUE_WORKFLOW_MILESTONES,
  STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";
import * as repo from "@/lib/playbooks/repository";
import type { MilestoneKind, PlaybookKind, PlaybookTask } from "@/lib/playbooks/types";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export const CLIENT_PLANNING_STARTER_NAME = "Standard Wedding — Client Planning";
export const CLIENT_PLANNING_STARTER_KEY = "PB-CLIENT-01";
export const CLIENT_PLANNING_STARTER_DESCRIPTION =
  "Guides your client through their own to-dos after booking, through post-event.";

export const VENUE_PLANNING_STARTER_NAME = "Standard Wedding — Venue Planning";
export const VENUE_PLANNING_STARTER_KEY = "PB-VENUE-01";
export const VENUE_PLANNING_STARTER_DESCRIPTION =
  "Runs your team's internal checklist for a booked event, from planning through post-event.";

export const CORPORATE_CLIENT_PLANNING_STARTER_NAME = "Standard Corporate — Client Planning";
export const CORPORATE_CLIENT_PLANNING_STARTER_KEY = "PB-CLIENT-CORP-01";
export const CORPORATE_CLIENT_PLANNING_STARTER_DESCRIPTION =
  "Optional starter for corporate hosts — goals, headcount, AV needs, and follow-up.";

export const CORPORATE_VENUE_PLANNING_STARTER_NAME = "Standard Corporate — Venue Planning";
export const CORPORATE_VENUE_PLANNING_STARTER_KEY = "PB-VENUE-CORP-01";
export const CORPORATE_VENUE_PLANNING_STARTER_DESCRIPTION =
  "Optional internal checklist for corporate bookings — room set, AV, run of show, and follow-up.";

export const SOCIAL_CLIENT_PLANNING_STARTER_NAME = "Standard Social — Client Planning";
export const SOCIAL_CLIENT_PLANNING_STARTER_KEY = "PB-CLIENT-SOCIAL-01";
export const SOCIAL_CLIENT_PLANNING_STARTER_DESCRIPTION =
  "Optional starter for social celebrations — vision, guest count, special moments, and thanks.";

export const SOCIAL_VENUE_PLANNING_STARTER_NAME = "Standard Social — Venue Planning";
export const SOCIAL_VENUE_PLANNING_STARTER_KEY = "PB-VENUE-SOCIAL-01";
export const SOCIAL_VENUE_PLANNING_STARTER_DESCRIPTION =
  "Optional internal checklist for social celebrations — layout, catering timing, timeline, and follow-up.";

type SeedMilestone = { name: string; kind: MilestoneKind | null };
type SeedTask = Omit<
  PlaybookTask,
  "id" | "templateId" | "venueId" | "createdAt" | "milestoneId" | "needsReview"
> & { milestoneIndex: number; needsReview?: boolean };

type PlanningStarterDef = {
  key: string;
  name: string;
  description: string;
  kind: PlaybookKind;
  eventType: string;
  milestones: SeedMilestone[];
  tasks: SeedTask[];
  /** Only wedding starters may become library defaults when none exist yet. */
  mayBecomeDefault: boolean;
};

const PLANNING_STARTERS: readonly PlanningStarterDef[] = [
  {
    key: CLIENT_PLANNING_STARTER_KEY,
    name: CLIENT_PLANNING_STARTER_NAME,
    description: CLIENT_PLANNING_STARTER_DESCRIPTION,
    kind: "client",
    eventType: "wedding",
    milestones: STANDARD_CLIENT_PLANNING_MILESTONES,
    tasks: STANDARD_CLIENT_PLANNING_TASKS,
    mayBecomeDefault: true,
  },
  {
    key: VENUE_PLANNING_STARTER_KEY,
    name: VENUE_PLANNING_STARTER_NAME,
    description: VENUE_PLANNING_STARTER_DESCRIPTION,
    kind: "venue",
    eventType: "wedding",
    milestones: STANDARD_VENUE_WORKFLOW_MILESTONES,
    tasks: STANDARD_VENUE_WORKFLOW_TASKS,
    mayBecomeDefault: true,
  },
  {
    key: CORPORATE_CLIENT_PLANNING_STARTER_KEY,
    name: CORPORATE_CLIENT_PLANNING_STARTER_NAME,
    description: CORPORATE_CLIENT_PLANNING_STARTER_DESCRIPTION,
    kind: "client",
    eventType: "corporate",
    milestones: CORPORATE_CLIENT_PLANNING_MILESTONES,
    tasks: CORPORATE_CLIENT_PLANNING_TASKS,
    mayBecomeDefault: false,
  },
  {
    key: CORPORATE_VENUE_PLANNING_STARTER_KEY,
    name: CORPORATE_VENUE_PLANNING_STARTER_NAME,
    description: CORPORATE_VENUE_PLANNING_STARTER_DESCRIPTION,
    kind: "venue",
    eventType: "corporate",
    milestones: CORPORATE_VENUE_WORKFLOW_MILESTONES,
    tasks: CORPORATE_VENUE_WORKFLOW_TASKS,
    mayBecomeDefault: false,
  },
  {
    key: SOCIAL_CLIENT_PLANNING_STARTER_KEY,
    name: SOCIAL_CLIENT_PLANNING_STARTER_NAME,
    description: SOCIAL_CLIENT_PLANNING_STARTER_DESCRIPTION,
    kind: "client",
    eventType: "social_event",
    milestones: SOCIAL_CLIENT_PLANNING_MILESTONES,
    tasks: SOCIAL_CLIENT_PLANNING_TASKS,
    mayBecomeDefault: false,
  },
  {
    key: SOCIAL_VENUE_PLANNING_STARTER_KEY,
    name: SOCIAL_VENUE_PLANNING_STARTER_NAME,
    description: SOCIAL_VENUE_PLANNING_STARTER_DESCRIPTION,
    kind: "venue",
    eventType: "social_event",
    milestones: SOCIAL_VENUE_WORKFLOW_MILESTONES,
    tasks: SOCIAL_VENUE_WORKFLOW_TASKS,
    mayBecomeDefault: false,
  },
];

/**
 * Skip when this platform starter already exists by master key or same name.
 * Custom venue-authored playbooks must not block missing platform starters.
 */
export function shouldSkipPlanningStarterProvision(input: {
  hasMasterKey: boolean;
  hasSameName: boolean;
}): boolean {
  return input.hasMasterKey || input.hasSameName;
}

/** @deprecated Prefer shouldSkipPlanningStarterProvision — kept for existing tests. */
export function shouldSkipClientPlanningStarterProvision(input: {
  hasPbClient01: boolean;
  hasActiveClientTemplate: boolean;
  hasSameName: boolean;
}): boolean {
  void input.hasActiveClientTemplate;
  return shouldSkipPlanningStarterProvision({
    hasMasterKey: input.hasPbClient01,
    hasSameName: input.hasSameName,
  });
}

/** @deprecated Prefer shouldSkipPlanningStarterProvision — kept for existing tests. */
export function shouldSkipVenuePlanningStarterProvision(input: {
  hasPbVenue01: boolean;
  hasActiveVenueTemplate: boolean;
  hasSameName: boolean;
}): boolean {
  void input.hasActiveVenueTemplate;
  return shouldSkipPlanningStarterProvision({
    hasMasterKey: input.hasPbVenue01,
    hasSameName: input.hasSameName,
  });
}

async function seedTemplateTasks(
  client: DbClient,
  venueId: string,
  templateId: string,
  milestones: SeedMilestone[],
  tasks: SeedTask[],
): Promise<void> {
  const milestoneIds: string[] = [];
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i]!;
    milestoneIds.push(
      await repo.insertMilestone(client, venueId, templateId, m.name, i, m.kind ?? undefined),
    );
  }
  for (const { milestoneIndex, ...task } of tasks) {
    await repo.insertTemplateTask(client, venueId, templateId, {
      ...task,
      milestoneId: milestoneIds[milestoneIndex]!,
    });
  }
}

type TemplateRow = {
  id: string;
  name: string;
  kind: string;
  is_archived: boolean;
  source_master_key: string | null;
  is_default: boolean;
  event_type: string | null;
};

async function provisionOnePlanningStarter(
  client: DbClient,
  venueId: string,
  def: PlanningStarterDef,
  rows: TemplateRow[],
): Promise<"created" | "skipped"> {
  const skip = shouldSkipPlanningStarterProvision({
    hasMasterKey: rows.some((r) => r.source_master_key === def.key),
    hasSameName: rows.some((r) => r.name === def.name),
  });
  if (skip) return "skipped";

  const hasTypedDefault = rows.some(
    (r) =>
      r.kind === def.kind &&
      r.event_type === def.eventType &&
      r.is_default === true &&
      r.is_archived === false,
  );

  const templateId = await repo.insertTemplate(
    client,
    venueId,
    def.name,
    def.kind,
    def.eventType,
    def.description,
    {
      sourceMasterKey: def.key,
      isDefault: def.mayBecomeDefault && !hasTypedDefault,
    },
  );
  await seedTemplateTasks(client, venueId, templateId, def.milestones, def.tasks);
  rows.push({
    id: templateId,
    name: def.name,
    kind: def.kind,
    is_archived: false,
    source_master_key: def.key,
    is_default: def.mayBecomeDefault && !hasTypedDefault,
    event_type: def.eventType,
  });
  return "created";
}

export async function provisionClientPlanningStarter(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const { data: existing } = await client
    .from("playbook_templates")
    .select("id, name, kind, is_archived, source_master_key, is_default, event_type")
    .eq("venue_id", venueId);
  const rows = (existing ?? []) as TemplateRow[];
  const def = PLANNING_STARTERS.find((s) => s.key === CLIENT_PLANNING_STARTER_KEY)!;
  const result = await provisionOnePlanningStarter(client, venueId, def, rows);
  return result === "created"
    ? { created: [CLIENT_PLANNING_STARTER_KEY], skipped: [] }
    : { created: [], skipped: [CLIENT_PLANNING_STARTER_KEY] };
}

export async function provisionVenuePlanningStarter(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const { data: existing } = await client
    .from("playbook_templates")
    .select("id, name, kind, is_archived, source_master_key, is_default, event_type")
    .eq("venue_id", venueId);
  const rows = (existing ?? []) as TemplateRow[];
  const def = PLANNING_STARTERS.find((s) => s.key === VENUE_PLANNING_STARTER_KEY)!;
  const result = await provisionOnePlanningStarter(client, venueId, def, rows);
  return result === "created"
    ? { created: [VENUE_PLANNING_STARTER_KEY], skipped: [] }
    : { created: [], skipped: [VENUE_PLANNING_STARTER_KEY] };
}

export async function provisionPlaybookStarters(
  client: DbClient,
  venueId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const { data: existing } = await client
    .from("playbook_templates")
    .select("id, name, kind, is_archived, source_master_key, is_default, event_type")
    .eq("venue_id", venueId);
  const rows = (existing ?? []) as TemplateRow[];
  const created: string[] = [];
  const skipped: string[] = [];
  for (const def of PLANNING_STARTERS) {
    const result = await provisionOnePlanningStarter(client, venueId, def, rows);
    if (result === "created") created.push(def.key);
    else skipped.push(def.key);
  }
  return { created, skipped };
}

export async function seedPlaybookStarters(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const admin = createAdminClient();
  await provisionPlaybookStarters(admin, venueId);
}

/**
 * Lazy-ensure platform planning starters when a venue opens Library → Planning.
 * Recovers venues that missed initial provisioning without touching custom playbooks.
 */
export async function ensurePlaybookStartersForCurrentVenue(): Promise<{
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
  try {
    const result = await provisionPlaybookStarters(await createClient(), venue.id);
    return { ok: true, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not ensure planning starters.";
    console.error("[ensurePlaybookStartersForCurrentVenue]", message);
    return { ok: false, created: [], skipped: [], message };
  }
}
