/**
 * Lead ceremony/reception space preferences — historical intent only.
 * Server-only. Never writes event_space_assignments.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  normalizeLeadSpacePreference,
  occupancyAnchorSpaceIdFromPreferences,
  shouldShowLeadSpacePreference,
  type LeadEventSpacePreference,
  type LeadSpacePreferenceInput,
} from "@/lib/leads/space-preferences";
import type { LeadActionResult } from "@/lib/leads/types";
import { getSpaces } from "@/lib/availability/service";
import { getCurrentVenue } from "@/lib/venue/service";

type PreferenceRow = {
  use_key: string;
  preference_kind: string;
  space_id: string | null;
  external_location: string | null;
};

function mapRow(r: PreferenceRow): LeadEventSpacePreference | null {
  const normalized = normalizeLeadSpacePreference({
    useKey: r.use_key,
    preferenceKind: r.preference_kind,
    spaceId: r.space_id,
    externalLocation: r.external_location,
  });
  return normalized.ok ? normalized.value : null;
}

export async function getLeadSpacePreferences(leadId: string): Promise<LeadEventSpacePreference[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("lead_event_space_preferences") as any)
    .select("use_key, preference_kind, space_id, external_location")
    .eq("venue_id", venue.id)
    .eq("lead_id", leadId);
  if (error) throw error;
  return ((data ?? []) as PreferenceRow[]).map(mapRow).filter((p): p is LeadEventSpacePreference => p != null);
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

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("venue_id", venue.id)
    .maybeSingle<{ id: string }>();
  if (!lead) return { ok: false, message: "Lead not found." };

  const spaces = await getSpaces();
  const values: LeadEventSpacePreference[] = [];
  for (const raw of inputs) {
    const normalized = normalizeLeadSpacePreference(raw);
    if (!normalized.ok) return { ok: false, message: normalized.message };
    if (!shouldShowLeadSpacePreference(venue.spaceOperatingMode, spaces, normalized.value.useKey)) {
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
    if (seen.has(value.useKey)) return { ok: false, message: "Only one preference per ceremony or reception." };
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

  // Keep planned_event_space_id as occupancy/book anchor without exposing a
  // redundant Event Space control in multi-mode Lead UI.
  const anchor = occupancyAnchorSpaceIdFromPreferences(values);
  if (anchor) {
    const { error: plannedErr } = await supabase
      .from("leads")
      .update({ planned_event_space_id: anchor })
      .eq("id", leadId)
      .eq("venue_id", venue.id);
    if (plannedErr) throw plannedErr;
  }

  return { ok: true };
}
