/**
 * Provision the platform "Standard Wedding Setup" profile for a new venue.
 *
 * Runs after Library starters exist. Assigns event_type=wedding only —
 * never a null venue-default fallback. Idempotent: never overwrites an
 * existing profile of the same name, never steals an existing wedding
 * assignment, never creates invoices / EO / inventory / invitations.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  CLIENT_PLANNING_STARTER_KEY,
  VENUE_PLANNING_STARTER_KEY,
} from "@/lib/playbooks/provision";
import type { SetupDecisions } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";
import { profileHardConfigGaps } from "@/lib/event-setup/profile-config-gaps";
import { applicableSetupSteps } from "@/lib/event-setup/state";
import { DEFAULT_PLANNING_CAPABILITIES } from "@/lib/playbooks/capabilities";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export const STANDARD_WEDDING_SETUP_PROFILE_NAME = "Standard Wedding Setup";

const WEDDING_TIMELINE_MASTER_KEY = "TL-01";
const WEDDING_QUESTIONNAIRE_KEYS = ["QST-CP", "QST-FD"] as const;

/**
 * Capability decisions for the platform Standard Wedding Setup.
 *
 * - planning / timeline / questionnaires: Included with starter refs
 * - vendors: Included (Vendor Network is SoT; recommendations stay empty)
 * - floor_plans: Not included until the venue satisfies space-specific choices
 * - inventory / event_order: commercial — not Setup steps
 */
export function standardWeddingSetupDecisions(): SetupDecisions {
  return {
    planning: "set_up",
    timeline: "set_up",
    questionnaires: "set_up",
    vendors: "set_up",
    floor_plans: "skipped",
  };
}

async function findIdByMasterKey(
  client: DbClient,
  table: string,
  venueId: string,
  masterKey: string,
): Promise<string | null> {
  const { data } = await client
    .from(table)
    .select("id")
    .eq("venue_id", venueId)
    .eq("source_master_key", masterKey)
    .eq("is_archived", false)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

async function resolveTemplateRefs(
  client: DbClient,
  venueId: string,
): Promise<SetupTemplateRefs | null> {
  const [
    clientPlaybookId,
    venuePlaybookId,
    timelineId,
    ...questionnaireIds
  ] = await Promise.all([
    findIdByMasterKey(client, "playbook_templates", venueId, CLIENT_PLANNING_STARTER_KEY),
    findIdByMasterKey(client, "playbook_templates", venueId, VENUE_PLANNING_STARTER_KEY),
    findIdByMasterKey(client, "timeline_templates", venueId, WEDDING_TIMELINE_MASTER_KEY),
    ...WEDDING_QUESTIONNAIRE_KEYS.map((key) =>
      findIdByMasterKey(client, "questionnaire_templates", venueId, key),
    ),
  ]);

  if (!clientPlaybookId || !venuePlaybookId || !timelineId) {
    return null;
  }
  const questionnaires = questionnaireIds.filter((id): id is string => Boolean(id));
  if (questionnaires.length === 0) {
    return null;
  }

  return {
    planningPlaybookTemplateId: clientPlaybookId,
    venuePlanningPlaybookTemplateId: venuePlaybookId,
    timelineTemplateId: timelineId,
    timelineTemplateIds: [],
    floorPlanTemplateIds: [],
    defaultFloorPlanTemplateId: null,
    questionnaireTemplateIds: questionnaires,
    inventoryTemplateId: null,
    eventOrderTemplateId: null,
    requiredVendorIds: [],
    recommendedVendorIds: [],
  };
}

export async function provisionStandardWeddingSetupProfile(
  client: DbClient,
  venueId: string,
): Promise<{ created: boolean; skipped: boolean; profileId: string | null; reason?: string }> {
  const { data: existingByName } = await client
    .from("venue_setup_profiles")
    .select("id")
    .eq("venue_id", venueId)
    .eq("name", STANDARD_WEDDING_SETUP_PROFILE_NAME)
    .maybeSingle<{ id: string }>();

  if (existingByName) {
    // Ensure wedding assignment only when none exists yet — never overwrite.
    const { data: weddingAssign } = await client
      .from("venue_setup_profile_assignments")
      .select("id, profile_id")
      .eq("venue_id", venueId)
      .eq("event_type", "wedding")
      .maybeSingle<{ id: string; profile_id: string }>();

    if (!weddingAssign) {
      const { error } = await client.from("venue_setup_profile_assignments").insert({
        venue_id: venueId,
        profile_id: existingByName.id,
        event_type: "wedding",
      });
      if (error) {
        return {
          created: false,
          skipped: true,
          profileId: existingByName.id,
          reason: error.message,
        };
      }
    }

    return {
      created: false,
      skipped: true,
      profileId: existingByName.id,
      reason: "already_exists",
    };
  }

  const { data: weddingAssign } = await client
    .from("venue_setup_profile_assignments")
    .select("id, profile_id")
    .eq("venue_id", venueId)
    .eq("event_type", "wedding")
    .maybeSingle<{ id: string; profile_id: string }>();

  if (weddingAssign) {
    // Venue already chose a wedding profile — do not invent a second one.
    return {
      created: false,
      skipped: true,
      profileId: weddingAssign.profile_id,
      reason: "wedding_already_assigned",
    };
  }

  const decisions = standardWeddingSetupDecisions();
  const templateRefs = await resolveTemplateRefs(client, venueId);
  if (!templateRefs) {
    return {
      created: false,
      skipped: true,
      profileId: null,
      reason: "required_starters_missing",
    };
  }

  const applicable = applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES);
  const hardGaps = profileHardConfigGaps(decisions, templateRefs, applicable);
  if (hardGaps.length > 0) {
    return {
      created: false,
      skipped: true,
      profileId: null,
      reason: `hard_gaps:${hardGaps.map((g) => g.step).join(",")}`,
    };
  }

  const { data: inserted, error: insertError } = await client
    .from("venue_setup_profiles")
    .insert({
      venue_id: venueId,
      name: STANDARD_WEDDING_SETUP_PROFILE_NAME,
      decisions,
      template_refs: templateRefs,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted) {
    return {
      created: false,
      skipped: true,
      profileId: null,
      reason: insertError?.message ?? "insert_failed",
    };
  }

  const { error: assignError } = await client.from("venue_setup_profile_assignments").insert({
    venue_id: venueId,
    profile_id: inserted.id,
    event_type: "wedding",
  });
  if (assignError) {
    // Profile row exists; assignment failed — report but leave the profile.
    return {
      created: true,
      skipped: false,
      profileId: inserted.id,
      reason: `assignment_failed:${assignError.message}`,
    };
  }

  return { created: true, skipped: false, profileId: inserted.id };
}

export async function seedStandardWeddingSetupProfile(venueId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await provisionStandardWeddingSetupProfile(createAdminClient(), venueId);
}
