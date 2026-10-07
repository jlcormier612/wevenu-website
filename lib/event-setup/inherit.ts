/**
 * Snapshot a venue Setup Profile onto a newly booked event.
 *
 * Profile edits do not call this. An existing setup row is left alone,
 * so a later profile change cannot rewrite an event that already inherited
 * or an event that was decided without a profile.
 */
import type { createClient } from "@/integrations/supabase/server";

import {
  parseSetupDecisions,
  parseTemplateRefs,
  resolveSetupProfile,
  snapshotInheritedSetup,
  type VenueSetupProfile,
} from "@/lib/event-setup/profile";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type ProfileRow = {
  id: string;
  name: string;
  decisions: unknown;
  template_refs: unknown;
};

type AssignmentRow = {
  profile_id: string;
  event_type: string | null;
};

export async function inheritSetupProfileForNewEvent(
  supabase: DbClient,
  venueId: string,
  eventId: string,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("event_setup_states")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{ event_id: string }>();
  if (existingError) throw existingError;
  if (existing) return;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("event_type, event_date, start_time")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{ event_type: string | null; event_date: string | null; start_time: string | null }>();
  if (eventError) throw eventError;
  if (!event) return;

  const [{ data: profileRows, error: profileError }, { data: assignmentRows, error: assignmentError }] = await Promise.all([
    supabase.from("venue_setup_profiles").select("id, name, decisions, template_refs").eq("venue_id", venueId),
    supabase.from("venue_setup_profile_assignments").select("profile_id, event_type").eq("venue_id", venueId),
  ]);
  if (profileError) throw profileError;
  if (assignmentError) throw assignmentError;

  const profiles: VenueSetupProfile[] = ((profileRows ?? []) as ProfileRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    decisions: parseSetupDecisions(row.decisions),
    templateRefs: parseTemplateRefs(row.template_refs),
  }));
  const profile = resolveSetupProfile(
    profiles,
    ((assignmentRows ?? []) as AssignmentRow[]).map((row) => ({
      profileId: row.profile_id,
      eventType: row.event_type,
    })),
    event.event_type,
  );
  if (!profile) return;

  const snapshot = snapshotInheritedSetup(profile);
  const { error: insertError } = await supabase.from("event_setup_states").insert({
    event_id: eventId,
    venue_id: venueId,
    collapsed_at: null,
    decisions: {},
    uses_profile: true,
    profile_id: snapshot.profileId,
    profile_name: snapshot.profileName,
    inherited_decisions: snapshot.inheritedDecisions,
    inherited_template_refs: snapshot.inheritedTemplateRefs ?? {},
    overrides: {},
  });
  if (insertError) {
    if (insertError.code === "23505") return;
    throw insertError;
  }

  await applyInheritedTemplates(supabase, venueId, eventId, event.event_date, event.start_time, profile);
}

async function applyInheritedTemplates(
  supabase: DbClient,
  venueId: string,
  eventId: string,
  eventDate: string | null,
  startTime: string | null,
  profile: VenueSetupProfile,
): Promise<void> {
  const playbookId = profile.decisions.planning === "set_up"
    ? profile.templateRefs.planningPlaybookTemplateId
    : null;
  if (playbookId && eventDate) {
    try {
      const { getTemplate, applyPlaybookToEvent } = await import("@/lib/playbooks/service");
      // Client experience starter must be kind=client. Ignore stale venue-kind refs.
      const template = await getTemplate(playbookId);
      if (template && template.kind === "client" && !template.isArchived) {
        await applyPlaybookToEvent(eventId, playbookId, eventDate);
      } else {
        console.error(
          "Setup profile playbook apply skipped: planningPlaybookTemplateId is not an active client playbook.",
          playbookId,
        );
      }
    } catch (err) {
      console.error("Setup profile playbook apply failed:", err);
    }
  }

  const timelineId = profile.decisions.timeline === "set_up"
    ? profile.templateRefs.timelineTemplateId
    : null;
  if (timelineId) {
    try {
      const { data: entries } = await supabase
        .from("timeline_entries")
        .select("id")
        .eq("event_id", eventId)
        .limit(1);
      if (!entries || entries.length === 0) {
        const { applyTimelineTemplateToEvent } = await import("@/lib/timeline-templates/apply");
        // Default timeline only. Additional timeline templates are references, never merged.
        await applyTimelineTemplateToEvent(eventId, timelineId, startTime);
      }
    } catch (err) {
      console.error("Setup profile timeline apply failed:", err);
    }
  }

  if (profile.decisions.floor_plans === "set_up") {
    await applyInheritedFloorPlanOffers(supabase, venueId, eventId, profile);
  }

  if (profile.decisions.questionnaires === "set_up") {
    await applyInheritedQuestionnaires(eventId, profile);
  }

  if (profile.decisions.vendors === "set_up") {
    await applyInheritedVendorRecommendations(supabase, venueId, eventId, profile);
  }
}

/** Offer selected floor-plan templates to the client; preferred sorts first. */
async function applyInheritedFloorPlanOffers(
  supabase: DbClient,
  venueId: string,
  eventId: string,
  profile: VenueSetupProfile,
): Promise<void> {
  const preferred = profile.templateRefs.defaultFloorPlanTemplateId ?? null;
  const selected = new Set(profile.templateRefs.floorPlanTemplateIds ?? []);
  if (preferred) selected.add(preferred);
  if (selected.size === 0) return;

  try {
    const { data: existing } = await supabase
      .from("event_floor_plan_offers")
      .select("id")
      .eq("event_id", eventId)
      .eq("venue_id", venueId)
      .limit(1);
    if (existing && existing.length > 0) return;

    const { upsertOffer } = await import("@/lib/floor-plan-offers/repository");
    const ordered = [
      ...(preferred ? [preferred] : []),
      ...[...selected].filter((id) => id !== preferred),
    ];
    for (let i = 0; i < ordered.length; i += 1) {
      await upsertOffer(supabase, venueId, eventId, {
        templateId: ordered[i]!,
        sortOrder: i,
        isOffered: true,
      });
    }
  } catch (err) {
    console.error("Setup profile floor-plan offers apply failed:", err);
  }
}

/**
 * Snapshot selected questionnaire templates onto the event as drafts.
 * Does not send — staff still send when ready; portal only shows sent forms.
 */
async function applyInheritedQuestionnaires(
  eventId: string,
  profile: VenueSetupProfile,
): Promise<void> {
  const ids = profile.templateRefs.questionnaireTemplateIds ?? [];
  if (ids.length === 0) return;
  try {
    const { applyTemplateToEvent } = await import("@/lib/questionnaire-templates/service");
    for (const templateId of ids) {
      await applyTemplateToEvent(templateId, eventId);
    }
  } catch (err) {
    console.error("Setup profile questionnaire apply failed:", err);
  }
}

async function applyInheritedVendorRecommendations(
  supabase: DbClient,
  venueId: string,
  eventId: string,
  profile: VenueSetupProfile,
): Promise<void> {
  const recommended = profile.templateRefs.recommendedVendorIds ?? [];
  if (recommended.length === 0) return;
  try {
    const { addRecommendation } = await import("@/lib/vendor-recommendations/repository");
    for (const vendorId of recommended) {
      await addRecommendation(supabase, venueId, eventId, vendorId, null);
    }
  } catch (err) {
    console.error("Setup profile vendor recommendations apply failed:", err);
  }
}
