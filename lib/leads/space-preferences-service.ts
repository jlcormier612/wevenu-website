/**
 * Lead space preferences — historical intent only.
 * Server-only. Never writes event_space_assignments.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveExperienceProfile } from "@/lib/event-experience";
import {
  normalizeLeadSpacePreference,
  occupancyAnchorSpaceIdFromPreferences,
  shouldShowLeadSpacePreference,
  type LeadEventSpacePreference,
  type LeadSpacePreferenceInput,
} from "@/lib/leads/space-preferences";
import type { LeadActionResult } from "@/lib/leads/types";
import { getSpaces } from "@/lib/availability/service";
import { relevantUsesForExperience } from "@/lib/venue-spaces/relevant-uses";
import { getCurrentVenue } from "@/lib/venue/service";

type PreferenceRow = {
  use_key: string;
  preference_kind: string;
  space_id: string | null;
  external_location: string | null;
};

function mapRow(
  r: PreferenceRow,
  profile = resolveExperienceProfile("wedding"),
): LeadEventSpacePreference | null {
  const normalized = normalizeLeadSpacePreference({
    useKey: r.use_key,
    preferenceKind: r.preference_kind,
    spaceId: r.space_id,
    externalLocation: r.external_location,
  }, { profile });
  return normalized.ok ? normalized.value : null;
}

async function resolveLeadExperienceType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  leadId: string,
): Promise<{ eventType: string | null; leadFound: boolean }> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, event_type")
    .eq("id", leadId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string; event_type: string | null }>();
  if (!lead) return { eventType: null, leadFound: false };
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("lead_id", leadId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string }>();
  if (client?.id) {
    const { data: event } = await supabase
      .from("events")
      .select("event_type")
      .eq("client_id", client.id)
      .eq("venue_id", venueId)
      .maybeSingle<{ event_type: string | null }>();
    const eventType = event?.event_type?.trim() || lead.event_type;
    return { eventType, leadFound: true };
  }
  return { eventType: lead.event_type, leadFound: true };
}

export async function getLeadSpacePreferences(leadId: string): Promise<LeadEventSpacePreference[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { eventType } = await resolveLeadExperienceType(supabase, venue.id, leadId);
  const profile = resolveExperienceProfile(eventType);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("lead_event_space_preferences") as any)
    .select("use_key, preference_kind, space_id, external_location")
    .eq("venue_id", venue.id)
    .eq("lead_id", leadId);
  if (error) throw error;
  const spaces = await getSpaces();
  const allowed = new Set(relevantUsesForExperience(spaces, profile).map((use) => use.key));
  return ((data ?? []) as PreferenceRow[])
    .map((row) => mapRow(row, profile))
    .filter((p): p is LeadEventSpacePreference => p != null && allowed.has(p.useKey));
}

export async function saveLeadSpacePreferences(
  leadId: string,
  inputs: LeadSpacePreferenceInput[],
): Promise<LeadActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found. Complete setup first." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired. Please sign in again." };

  const { eventType, leadFound } = await resolveLeadExperienceType(supabase, venue.id, leadId);
  if (!leadFound) return { ok: false, message: "Lead not found." };

  const spaces = await getSpaces();
  const profile = resolveExperienceProfile(eventType);
  const relevant = relevantUsesForExperience(spaces, profile);
  const allowedUseKeys = relevant.map((use) => use.key);
  const values: LeadEventSpacePreference[] = [];
  for (const raw of inputs) {
    const normalized = normalizeLeadSpacePreference(raw, { allowedUseKeys, profile });
    if (!normalized.ok) return { ok: false, message: normalized.message };
    if (!shouldShowLeadSpacePreference(venue.spaceOperatingMode, spaces, normalized.value.useKey, eventType)) {
      return { ok: false, message: "That space preference is not available for this venue." };
    }
    if (normalized.value.preferenceKind === "venue_space") {
      const space = spaces.find((s) => s.id === normalized.value.spaceId);
      if (!space || space.venueId !== venue.id) {
        return { ok: false, message: "That event space is not on this venue." };
      }
    }
    values.push(normalized.value);
  }

  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.useKey)) return { ok: false, message: "Only one preference per space use." };
    seen.add(value.useKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("lead_event_space_preferences") as any).upsert(
      {
        venue_id: venue.id,
        lead_id: leadId,
        use_key: value.useKey,
        preference_kind: value.preferenceKind,
        space_id: value.spaceId,
        external_location: value.externalLocation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,use_key" },
    );
    if (error) throw error;
  }

  if (allowedUseKeys.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let prune = (supabase.from("lead_event_space_preferences") as any)
      .delete()
      .eq("venue_id", venue.id)
      .eq("lead_id", leadId);
    prune = prune.not("use_key", "in", `(${allowedUseKeys.join(",")})`);
    const { error: pruneErr } = await prune;
    if (pruneErr) throw pruneErr;
  }

  const anchor = occupancyAnchorSpaceIdFromPreferences(values, {
    weddingFamily: profile.isWeddingSpecific,
    relevantUseKeys: allowedUseKeys,
  });
  // Clear when no applicable venue_space remains (N/A / undecided / external only).
  const { error: plannedErr } = await supabase
    .from("leads")
    .update({ planned_event_space_id: anchor })
    .eq("id", leadId)
    .eq("venue_id", venue.id);
  if (plannedErr) throw plannedErr;

  return { ok: true };
}
