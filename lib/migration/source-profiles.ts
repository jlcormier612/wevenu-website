/**
 * Migration Center — source profile registry.
 *
 * The DB `source_profiles` table (supabase/migrations/20261300000000_
 * migration_center_engine.sql) is the attribution source of truth — UI copy
 * describing a source must read those flags, never hand-write per-source
 * claims. This file is the parallel TS-side registry mapping each source
 * key to its parser/adapter implementation, mirroring the same DB-row-for-
 * attribution / TS-code-for-behavior split `lead_sources` already
 * established. Adding a new source is one migration INSERT (a new
 * source_profiles row) plus one adapter file registered here — never a
 * Migration Center redesign.
 */
import type { AnyDbClient } from "@/lib/lead-intake/types";
import type { SourceAdapter, SourceKey, SourceProfile } from "@/lib/migration/types";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import { wevenLegacyAdapter } from "@/lib/migration/sources/weven-legacy";

const ADAPTERS: Record<SourceKey, SourceAdapter> = {
  generic_csv: genericCsvAdapter,
  // The Knot / WeddingWire / Planning Pod / HoneyBook have no adapter yet —
  // every row from those sources falls back to genericCsvAdapter's own
  // recognition/normalization until a real column-signature profile is
  // built for each (docs/migration-cutover-architecture.md §F, Slice 7).
  // Selecting one of these sources today changes the venue-facing copy and
  // history label only — it must never imply a live connection or
  // intelligent parsing that doesn't exist yet.
  the_knot: genericCsvAdapter,
  weddingwire: genericCsvAdapter,
  planning_pod: genericCsvAdapter,
  honeybook: genericCsvAdapter,
  // First real source-specific adapter (see lib/migration/sources/weven-
  // legacy.ts for exactly what's verified vs. deliberately not assumed).
  weven_legacy: wevenLegacyAdapter,
};

export function getSourceAdapter(key: SourceKey): SourceAdapter {
  return ADAPTERS[key] ?? genericCsvAdapter;
}

/** Best-effort recognition across every registered adapter, for the "we noticed this looks like a HoneyBook export" moment — never authoritative on its own; the operator/venue can always pick a different source explicitly. */
export function recognizeSource(headers: string[]): SourceKey | null {
  for (const [key, adapter] of Object.entries(ADAPTERS) as [SourceKey, SourceAdapter][]) {
    if (key === "generic_csv") continue;
    if (adapter.recognizes(headers)) return key;
  }
  return null;
}

function mapProfile(r: Record<string, unknown>): SourceProfile {
  return {
    key: r.key as SourceKey,
    displayName: r.display_name as string,
    hasDirectConnection: r.has_direct_connection as boolean,
    forwardOnly: r.forward_only as boolean,
    exportAssisted: r.export_assisted as boolean,
    whiteGloveRecommended: r.white_glove_recommended as boolean,
    supportedFileTypes: (r.supported_file_types ?? []) as string[],
    hasKnownParser: r.has_known_parser as boolean,
    historicalLimitations: (r.historical_limitations ?? null) as string | null,
    isEnabled: r.is_enabled as boolean,
  };
}

export async function getSourceProfiles(client: AnyDbClient): Promise<SourceProfile[]> {
  const { data, error } = await client.from("source_profiles").select("*").eq("is_enabled", true).order("display_name");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapProfile);
}

export async function getSourceProfile(client: AnyDbClient, key: SourceKey): Promise<SourceProfile | null> {
  const { data, error } = await client.from("source_profiles").select("*").eq("key", key).maybeSingle<Record<string, unknown>>();
  if (error || !data) return null;
  return mapProfile(data);
}
