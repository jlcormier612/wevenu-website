/**
 * Luv settings service. Server-only.
 * Upsert semantics — the row is created on first save.
 * When no row exists, returns defaults so venues experience Luv immediately.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type LuvSettings = {
  observationsEnabled: boolean;
  draftingEnabled: boolean;
  autonomyLevel: "suggest_only" | "draft_for_review";
  preferredTone: "warm" | "professional" | "formal";
};

type Row = {
  observations_enabled: boolean;
  drafting_enabled: boolean;
  autonomy_level: string;
  preferred_tone: string;
};

const DEFAULTS: LuvSettings = {
  observationsEnabled: true,
  draftingEnabled: true,
  autonomyLevel: "draft_for_review",
  preferredTone: "warm",
};

function mapRow(r: Row): LuvSettings {
  return {
    observationsEnabled: r.observations_enabled,
    draftingEnabled: r.drafting_enabled,
    autonomyLevel: r.autonomy_level as LuvSettings["autonomyLevel"],
    preferredTone: r.preferred_tone as LuvSettings["preferredTone"],
  };
}

export async function getLuvSettings(): Promise<LuvSettings> {
  if (!isSupabaseConfigured) return DEFAULTS;
  const venue = await getCurrentVenue();
  if (!venue) return DEFAULTS;
  const supabase = await createClient();
  const { data } = await supabase.from("luv_settings").select("*")
    .eq("venue_id", venue.id).maybeSingle<Row>();
  return data ? mapRow(data) : DEFAULTS;
}

export async function saveLuvSettings(settings: LuvSettings): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase.from("luv_settings").upsert({
    venue_id: venue.id,
    observations_enabled: settings.observationsEnabled,
    drafting_enabled: settings.draftingEnabled,
    autonomy_level: settings.autonomyLevel,
    preferred_tone: settings.preferredTone,
  }, { onConflict: "venue_id" });
}
