/**
 * Migration Center — venue-facing source selection (UX only).
 *
 * Does not change adapters, sessions, or DB profiles. The only systems with
 * real source-specific import handling today are HoneyBook and Tripleseat
 * (file recognition + name normalization; no live/API/OAuth connection).
 * Weven, The Knot, WeddingWire, and Planning Pod remain in `source_profiles`
 * for history/attribution and fall through to generic CSV — they must not
 * appear here as "recognized" systems.
 *
 * Principle: source-specific adapters are accelerators, not membership tiers.
 */
import type { SourceKey, SourceProfile } from "@/lib/migration/types";

export type SourceSelectionLane = "honeybook" | "tripleseat" | "another_system" | "not_sure";

/** Keys whose adapters actually do source-specific recognition/normalization. */
export const SOURCE_SPECIFIC_KEYS: readonly SourceKey[] = ["honeybook", "tripleseat"];

export const SOURCE_SELECTION_LANES: {
  id: SourceSelectionLane;
  label: string;
  description: string;
}[] = [
  {
    id: "honeybook",
    label: "HoneyBook",
    description: "We recognize HoneyBook exports and can organize your data automatically.",
  },
  {
    id: "tripleseat",
    label: "Tripleseat",
    description: "We recognize Tripleseat exports and can organize your data automatically.",
  },
  {
    id: "another_system",
    label: "Another system",
    description:
      "Using a different CRM or venue platform? No problem. Export your data as a CSV and we'll help you match it to Hello to Cheers.",
  },
  {
    id: "not_sure",
    label: "I'm not sure",
    description: "We'll guide you through the easiest way to bring your information over.",
  },
];

/** True only for HoneyBook and Tripleseat — not Weven, The Knot, or generic CSV. */
export function hasSourceSpecificAcceleration(key: SourceKey): boolean {
  return (SOURCE_SPECIFIC_KEYS as readonly string[]).includes(key);
}

/** Named profiles shown as first-class radios — only real adapters, never the generic catch-all. */
export function namedSourceProfiles(profiles: SourceProfile[]): SourceProfile[] {
  return profiles.filter((p) => p.isEnabled && hasSourceSpecificAcceleration(p.key));
}

export function genericSourceProfile(profiles: SourceProfile[]): SourceProfile | null {
  return profiles.find((p) => p.key === "generic_csv") ?? null;
}

/** Map a visible selection to the session `source_key` used by the existing engine. */
export function sourceKeyForLane(lane: SourceSelectionLane): SourceKey {
  if (lane === "honeybook") return "honeybook";
  if (lane === "tripleseat") return "tripleseat";
  return "generic_csv";
}

/** If file recognition hits a real adapter, select that radio; otherwise leave the venue's choice. */
export function laneForRecognizedSource(key: SourceKey): SourceSelectionLane | null {
  if (key === "honeybook" || key === "tripleseat") return key;
  return null;
}

/**
 * Customer-facing guidance from lane + profile flags — never implies a live
 * connection, and never treats generic import as a lesser path.
 */
export function sourceSelectionGuidance(
  lane: SourceSelectionLane,
  profile: SourceProfile | null,
): { headline: string; body: string } {
  if (lane === "not_sure") {
    return {
      headline: "We'll guide you from here",
      body:
        "If you can export clients, leads, or vendors as a CSV from wherever you keep them today, upload it below and match the columns. If you only have a simple spreadsheet, that works too. Either path is a real migration — not a workaround.",
    };
  }

  if (lane === "another_system" || !profile || profile.key === "generic_csv") {
    return {
      headline: "Your system doesn't need to be listed",
      body:
        "Export what you want to bring over (clients, leads, or vendors), upload the CSV, and match the columns. We'll check for duplicates and let you review before anything is created in Hello to Cheers.",
    };
  }

  return {
    headline: `Moving from ${profile.displayName}`,
    body:
      "Upload an export from this system. We may recognize and organize columns automatically — you can always adjust the mapping before we import. This never connects to or logs into another platform on your behalf.",
  };
}

export const MIGRATION_CENTER_INTRO = {
  title: "Bring your business with you",
  body:
    "Moving from another system? Choose it below and we'll give you the best way to bring your information into Hello to Cheers. If you don't see your system, that's okay — you can still import your data from a CSV or spreadsheet.",
} as const;

/** History / session label — generic_csv is a first-class path, not a lesser tier. */
export function sourceHistoryLabel(
  profile: SourceProfile | undefined,
  sourceKey: SourceKey,
): string {
  if (sourceKey === "generic_csv") return "Another system";
  return profile?.displayName ?? sourceKey;
}
