/**
 * Venue Setup Profile persistence.
 * Writes profiles and assignments only. Never updates event_setup_states or event_tasks.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import {
  missingProfileDecisions,
  parseSetupDecisions,
  parseTemplateRefs,
  serializeTemplateRefs,
  type SetupProfileAssignment,
  type SetupTemplateRefs,
  type VenueSetupProfile,
} from "@/lib/event-setup/profile";
import { validateSetupProfileEventTypes } from "@/lib/event-setup/setup-profile-event-types";
import { applicableSetupSteps, type SetupDecisions, type SetupStepKey } from "@/lib/event-setup/state";
import type { VenuePlanningCapabilities } from "@/lib/playbooks/capabilities";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

export type VenueSetupProfileList = {
  profiles: VenueSetupProfile[];
  assignments: SetupProfileAssignment[];
};

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

function mapProfile(row: ProfileRow): VenueSetupProfile {
  return {
    id: row.id,
    name: row.name,
    decisions: parseSetupDecisions(row.decisions),
    templateRefs: parseTemplateRefs(row.template_refs),
  };
}

export async function listVenueSetupProfiles(venueId: string): Promise<VenueSetupProfileList> {
  const supabase = await createClient();
  const [{ data: profiles, error: profileError }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase.from("venue_setup_profiles").select("id, name, decisions, template_refs").eq("venue_id", venueId).order("name"),
    supabase.from("venue_setup_profile_assignments").select("profile_id, event_type").eq("venue_id", venueId),
  ]);
  if (profileError) throw profileError;
  if (assignmentError) throw assignmentError;
  return {
    profiles: ((profiles ?? []) as ProfileRow[]).map(mapProfile),
    assignments: ((assignments ?? []) as AssignmentRow[]).map((row) => ({
      profileId: row.profile_id,
      eventType: row.event_type,
    })),
  };
}

export type SaveSetupProfileInput = {
  id?: string | null;
  name: string;
  decisions: SetupDecisions;
  templateRefs: SetupTemplateRefs;
  /** Canonical event type keys. */
  eventTypes: string[];
  venueDefault: boolean;
  applicable: readonly SetupStepKey[];
};

async function requireManagerVenue(): Promise<{ ok: true; venueId: string } | { ok: false; message: string }> {
  const [venue, role] = await Promise.all([getCurrentVenue(), getCurrentUserRole()]);
  if (!venue) return { ok: false, message: "No venue found." };
  if (role !== "owner" && role !== "manager") {
    return { ok: false, message: "Only an owner or manager can change how this venue normally operates." };
  }
  return { ok: true, venueId: venue.id };
}

export async function saveVenueSetupProfile(
  input: SaveSetupProfileInput,
): Promise<{ ok: true; profileId: string } | { ok: false; message: string }> {
  const gate = await requireManagerVenue();
  if (!gate.ok) return gate;
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name this setup profile." };
  const missing = missingProfileDecisions(input.applicable, input.decisions);
  if (missing.length > 0) return { ok: false, message: "Choose included or not included for every area." };

  const supabase = await createClient();
  const { data: venueRow, error: venueError } = await supabase
    .from("venues")
    .select("accepted_inquiry_event_types")
    .eq("id", gate.venueId)
    .maybeSingle<{ accepted_inquiry_event_types: unknown }>();
  if (venueError) return { ok: false, message: venueError.message };

  const validated = validateSetupProfileEventTypes(
    input.eventTypes,
    venueRow?.accepted_inquiry_event_types,
  );
  if (!validated.ok) return validated;
  const eventTypes = validated.eventTypes;

  const decisions = parseSetupDecisions(input.decisions);
  delete decisions.portal;

  const templateRefs = serializeTemplateRefs(input.templateRefs);
  const planningId = templateRefs.planningPlaybookTemplateId ?? null;
  if (planningId) {
    const { data: playbook } = await supabase
      .from("playbook_templates")
      .select("id, kind, is_archived")
      .eq("id", planningId)
      .eq("venue_id", gate.venueId)
      .maybeSingle<{ id: string; kind: string; is_archived: boolean }>();
    if (!playbook || playbook.kind !== "client" || playbook.is_archived) {
      templateRefs.planningPlaybookTemplateId = null;
    }
  }

  const payload = {
    venue_id: gate.venueId,
    name,
    decisions,
    template_refs: templateRefs,
    updated_at: new Date().toISOString(),
  };

  let profileId = input.id ?? null;
  if (profileId) {
    const { error } = await supabase
      .from("venue_setup_profiles")
      .update(payload)
      .eq("id", profileId)
      .eq("venue_id", gate.venueId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { data, error } = await supabase
      .from("venue_setup_profiles")
      .insert(payload)
      .select("id")
      .single<{ id: string }>();
    if (error || !data) return { ok: false, message: error?.message ?? "Could not save this setup profile." };
    profileId = data.id;
  }

  const { error: clearOwn } = await supabase
    .from("venue_setup_profile_assignments")
    .delete()
    .eq("venue_id", gate.venueId)
    .eq("profile_id", profileId);
  if (clearOwn) return { ok: false, message: clearOwn.message };

  const claimed: (string | null)[] = [...eventTypes];
  if (input.venueDefault) claimed.push(null);

  for (const eventType of claimed) {
    let removal = supabase.from("venue_setup_profile_assignments").delete().eq("venue_id", gate.venueId);
    removal = eventType == null ? removal.is("event_type", null) : removal.eq("event_type", eventType);
    const { error: removeError } = await removal;
    if (removeError) return { ok: false, message: removeError.message };
    const { error: insertError } = await supabase.from("venue_setup_profile_assignments").insert({
      venue_id: gate.venueId,
      profile_id: profileId,
      event_type: eventType,
    });
    if (insertError) return { ok: false, message: insertError.message };
  }

  return { ok: true, profileId };
}

export async function deleteVenueSetupProfile(
  profileId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await requireManagerVenue();
  if (!gate.ok) return gate;
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_setup_profiles")
    .delete()
    .eq("id", profileId)
    .eq("venue_id", gate.venueId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Drop type-specific setup-profile assignments for event types no longer accepted.
 * Leaves venue-default (event_type IS NULL) and profile rows untouched.
 * Never touches event_setup_states.
 */
export async function pruneSetupProfileAssignmentsForRemovedEventTypes(
  venueId: string,
  removedEventTypes: readonly string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const types = [...new Set(removedEventTypes.filter(Boolean))];
  if (types.length === 0) return { ok: true };
  const admin = createAdminClient();
  const { error } = await admin
    .from("venue_setup_profile_assignments")
    .delete()
    .eq("venue_id", venueId)
    .in("event_type", types);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function applicableStepsForVenue(caps: VenuePlanningCapabilities): SetupStepKey[] {
  return applicableSetupSteps(caps);
}
