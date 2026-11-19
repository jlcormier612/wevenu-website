/**
 * Luv settings service. Server-only.
 * Upsert semantics — the row is created on first save.
 * When no row exists, returns defaults so venues experience Luv immediately.
 *
 * Master gate (`enabled`): default ON. Explicit OFF fails closed across Luv
 * execution paths. Settings read errors must not be treated as enabled.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type LuvSettings = {
  /** Master Enable Luv. Default true. */
  enabled: boolean;
  observationsEnabled: boolean;
  draftingEnabled: boolean;
  autonomyLevel: "suggest_only" | "draft_for_review";
  preferredTone: "warm" | "professional" | "formal";
};

type Row = {
  enabled?: boolean | null;
  observations_enabled: boolean;
  drafting_enabled: boolean;
  autonomy_level: string;
  preferred_tone: string;
};

export type LuvSettingsLoadResult =
  | { ok: true; settings: LuvSettings; source: "row" | "default" }
  | { ok: false; reason: "not_configured" | "no_venue" | "read_error" | "invalid_venue" };

export class LuvSettingsUnauthorizedError extends Error {
  constructor(message = "Not authorized to update Luv settings for this venue.") {
    super(message);
    this.name = "LuvSettingsUnauthorizedError";
  }
}

export class LuvSettingsPersistError extends Error {
  constructor(message = "Could not save Luv settings.") {
    super(message);
    this.name = "LuvSettingsPersistError";
  }
}

const DEFAULTS: LuvSettings = {
  enabled: true,
  observationsEnabled: true,
  draftingEnabled: true,
  autonomyLevel: "draft_for_review",
  preferredTone: "warm",
};

/** Canonical tone instructions reused by coordinator drafts and Luv Ask. */
export const LUV_TONE_INSTRUCTION: Record<LuvSettings["preferredTone"], string> = {
  warm:
    "Write in a warm & friendly style: personable, approachable, and conversational — warm without becoming cheesy or overly enthusiastic.",
  professional:
    "Write in a professional style: polished, courteous, and confident — business-appropriate without sounding cold or robotic.",
  formal:
    "Write in a formal style: more structured, precise, and formal while remaining clear and respectful.",
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

/** Master Enable Luv — explicit false only disables; missing/true stay on. */
export function isLuvEnabled(settings: Pick<LuvSettings, "enabled">): boolean {
  return settings.enabled !== false;
}

export function isLuvDraftingEnabled(settings: Pick<LuvSettings, "draftingEnabled">): boolean {
  return settings.draftingEnabled !== false;
}

/** Nested drafting is effective only while the master switch is on. */
export function isLuvDraftingEffectivelyEnabled(
  settings: Pick<LuvSettings, "enabled" | "draftingEnabled">,
): boolean {
  return isLuvEnabled(settings) && isLuvDraftingEnabled(settings);
}

/** Nested observations are effective only while the master switch is on. */
export function isLuvObservationsEffectivelyEnabled(
  settings: Pick<LuvSettings, "enabled" | "observationsEnabled">,
): boolean {
  return isLuvEnabled(settings) && settings.observationsEnabled !== false;
}

/** Fail-closed settings shape used when a read cannot be trusted. */
export function luvSettingsFailClosed(): LuvSettings {
  return {
    ...DEFAULTS,
    enabled: false,
  };
}

export function defaultLuvSettings(): LuvSettings {
  return { ...DEFAULTS };
}

function mapRow(r: Row): LuvSettings {
  return {
    // Missing column (pre-migration) must not flip venues off — treat null/undefined as on.
    enabled: r.enabled !== false,
    observationsEnabled: r.observations_enabled,
    draftingEnabled: r.drafting_enabled !== false,
    autonomyLevel: r.autonomy_level === "suggest_only" ? "suggest_only" : "draft_for_review",
    preferredTone: normalizePreferredTone(r.preferred_tone),
  };
}

async function loadRowForVenueId(
  venueId: string,
  client: { from: (table: string) => any },
): Promise<LuvSettingsLoadResult> {
  const { data, error } = await client
    .from("luv_settings")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) return { ok: false, reason: "read_error" };
  if (!data) return { ok: true, settings: defaultLuvSettings(), source: "default" };
  return { ok: true, settings: mapRow(data as Row), source: "row" };
}

/**
 * Authoritative load for the current staff venue.
 * Read errors → ok:false (callers must fail closed for master).
 * No row → defaults (master ON).
 */
export async function loadLuvSettings(): Promise<LuvSettingsLoadResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: "not_configured" };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, reason: "no_venue" };
  try {
    const supabase = await createClient();
    return await loadRowForVenueId(venue.id, supabase);
  } catch {
    return { ok: false, reason: "read_error" };
  }
}

/**
 * Load settings for a known venue id (portal / guest / HQ paths).
 * venueId must come from authenticated or token-validated context — never
 * trust an arbitrary client-supplied id for authorization of writes.
 */
export async function loadLuvSettingsForVenueId(venueId: string): Promise<LuvSettingsLoadResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: "not_configured" };
  if (!venueId) return { ok: false, reason: "invalid_venue" };
  try {
    const admin = createAdminClient();
    return await loadRowForVenueId(venueId, admin);
  } catch {
    return { ok: false, reason: "read_error" };
  }
}

/**
 * Convenience for UI: returns settings, failing closed (enabled:false) on
 * read errors so surfaces do not render Luv as available.
 */
export async function getLuvSettings(): Promise<LuvSettings> {
  const result = await loadLuvSettings();
  if (!result.ok) return luvSettingsFailClosed();
  return result.settings;
}

/** Portal / token convenience — fail closed on read errors. */
export async function getLuvSettingsForVenueId(venueId: string): Promise<LuvSettings> {
  const result = await loadLuvSettingsForVenueId(venueId);
  if (!result.ok) return luvSettingsFailClosed();
  return result.settings;
}

/** True only when settings load succeeded and master is ON. */
export async function isLuvMasterEnabledForCurrentVenue(): Promise<boolean> {
  const result = await loadLuvSettings();
  if (!result.ok) return false;
  return isLuvEnabled(result.settings);
}

/** True only when settings load succeeded and master is ON for venueId. */
export async function isLuvMasterEnabledForVenueId(venueId: string): Promise<boolean> {
  const result = await loadLuvSettingsForVenueId(venueId);
  if (!result.ok) return false;
  return isLuvEnabled(result.settings);
}

export async function saveLuvSettings(settings: LuvSettings): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new LuvSettingsUnauthorizedError("Backend is not configured.");
  }
  const venue = await getCurrentVenue();
  if (!venue) {
    throw new LuvSettingsUnauthorizedError();
  }
  const supabase = await createClient();
  // Launch invariant: Luv never sends without human approval. autonomyLevel is
  // not customer-selectable; always persist draft_for_review so the column
  // cannot imply a false autonomous mode.
  const { error } = await supabase.from("luv_settings").upsert(
    {
      venue_id: venue.id,
      enabled: settings.enabled !== false,
      observations_enabled: settings.observationsEnabled,
      drafting_enabled: settings.draftingEnabled,
      autonomy_level: "draft_for_review",
      preferred_tone: normalizePreferredTone(settings.preferredTone),
    },
    { onConflict: "venue_id" },
  );
  if (error) {
    throw new LuvSettingsPersistError(error.message);
  }
}
