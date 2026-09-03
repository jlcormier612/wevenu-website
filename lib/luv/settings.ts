/**
 * Luv settings service. Server-only.
 * Upsert semantics — the row is created on first save.
 * When no row exists, returns defaults so venues experience Luv immediately.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
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

/** Canonical tone instructions reused by coordinator drafts and Luv Ask. */
export const LUV_TONE_INSTRUCTION: Record<LuvSettings["preferredTone"], string> = {
  warm: "Write in a warm, friendly, personal tone — like a real person at a boutique venue who genuinely cares.",
  professional: "Write in a professional, polished, and respectful tone appropriate for a business context.",
  formal: "Write in a formal, precise tone — best for corporate clients or high-profile events.",
};

export function normalizePreferredTone(value: string | null | undefined): LuvSettings["preferredTone"] {
  if (value === "professional" || value === "formal" || value === "warm") return value;
  return "warm";
}

export function luvToneInstruction(tone: string | null | undefined): string {
  return LUV_TONE_INSTRUCTION[normalizePreferredTone(tone)];
}

/** Couple-facing voice line for Luv Ask. Grounding rules stay separate. */
export function luvAskVoiceInstruction(tone: string | null | undefined): string {
  const normalized = normalizePreferredTone(tone);
  if (normalized === "professional") {
    return "Keep answers polished and courteous. Still be kind and concise. Never make up information.";
  }
  if (normalized === "formal") {
    return "Keep answers precise and gracious. Still be kind. Never make up information.";
  }
  return "Keep answers warm and personal — you're a trusted friend helping them plan, not a help desk.";
}

export function isLuvDraftingEnabled(settings: Pick<LuvSettings, "draftingEnabled">): boolean {
  return settings.draftingEnabled !== false;
}

function mapRow(r: Row): LuvSettings {
  return {
    observationsEnabled: r.observations_enabled,
    draftingEnabled: r.drafting_enabled !== false,
    autonomyLevel: r.autonomy_level === "suggest_only" ? "suggest_only" : "draft_for_review",
    preferredTone: normalizePreferredTone(r.preferred_tone),
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

/** Load settings for a known venue id (portal / token paths; bypasses staff RLS). */
export async function getLuvSettingsForVenueId(venueId: string): Promise<LuvSettings> {
  if (!isSupabaseConfigured || !venueId) return DEFAULTS;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("luv_settings").select("*")
      .eq("venue_id", venueId).maybeSingle<Row>();
    return data ? mapRow(data) : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
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
