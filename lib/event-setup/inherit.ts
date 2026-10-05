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

  await applyInheritedTemplates(supabase, eventId, event.event_date, event.start_time, profile);
}

async function applyInheritedTemplates(
  supabase: DbClient,
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
      const { applyPlaybookToEvent } = await import("@/lib/playbooks/service");
      await applyPlaybookToEvent(eventId, playbookId, eventDate);
    } catch (err) {
      console.error("Setup profile playbook apply failed:", err);
    }
  }

  const timelineId = profile.decisions.timeline === "set_up"
    ? profile.templateRefs.timelineTemplateId
    : null;
  if (!timelineId) return;
  try {
    const { data: entries } = await supabase
      .from("timeline_entries")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);
    if (entries && entries.length > 0) return;
    const { applyTimelineTemplateToEvent } = await import("@/lib/timeline-templates/apply");
    // Default timeline only. Additional timeline templates are references, never merged.
    await applyTimelineTemplateToEvent(eventId, timelineId, startTime);
  } catch (err) {
    console.error("Setup profile timeline apply failed:", err);
  }
}
