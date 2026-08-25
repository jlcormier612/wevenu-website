/**
 * Migration Center — venue-facing source selection (UX only).
 *
 * Does not change adapters, sessions, or DB profiles. Partitions the existing
 * `source_profiles` list so "another system" / "I'm not sure" are first-class
 * lanes that resolve to `generic_csv`, while named profiles remain available
 * for venues whose software we already list.
 *
 * Principle: source-specific adapters are accelerators, not membership tiers.
 */
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import { getSourceAdapter } from "@/lib/migration/source-profiles";
import type { SourceKey, SourceProfile } from "@/lib/migration/types";

export type SourceSelectionLane = "recognized" | "another_system" | "not_sure";

export const SOURCE_SELECTION_LANES: {
  id: SourceSelectionLane;
  label: string;
  description: string;
}[] = [
  {
    id: "recognized",
    label: "A system we recognize",
    description:
      "If you see your software below, choose it — we may be able to organize your export more specifically.",
  },
  {
    id: "another_system",
    label: "Another system",
    description:
      "Event Temple, Aisle Planner, Perfect Venue, Eventbrite, another CRM — or anything else. You can still bring your business over.",
  },
  {
    id: "not_sure",
    label: "I'm not sure",
    description:
      "We'll start with a guided upload and column matching. A simple spreadsheet works too.",
  },
];

/** Named profiles shown under "A system we recognize" — excludes the generic CSV catch-all. */
export function namedSourceProfiles(profiles: SourceProfile[]): SourceProfile[] {
  return profiles.filter((p) => p.key !== "generic_csv" && p.isEnabled);
}

export function genericSourceProfile(profiles: SourceProfile[]): SourceProfile | null {
  return profiles.find((p) => p.key === "generic_csv") ?? null;
}

/** True when the TS registry has a real adapter (not the generic CSV fallback). */
export function hasSourceSpecificAcceleration(key: SourceKey): boolean {
  if (key === "generic_csv") return false;
  return getSourceAdapter(key) !== genericCsvAdapter;
}

/** Map a selection lane to the session `source_key` used by the existing engine. */
export function sourceKeyForLane(
  lane: SourceSelectionLane,
  recognizedKey: SourceKey | null,
  profiles: SourceProfile[],
): SourceKey {
  if (lane === "another_system" || lane === "not_sure") {
    return "generic_csv";
  }
  if (recognizedKey && namedSourceProfiles(profiles).some((p) => p.key === recognizedKey)) {
    return recognizedKey;
  }
  const first = namedSourceProfiles(profiles)[0];
  return first?.key ?? "generic_csv";
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
        "If you can export clients, leads, or vendors as a CSV from wherever you keep them today, upload it below and match the columns. If you only have a simple spreadsheet, Spreadsheet import in Setup Hub works the same careful way. Either path is a real migration — not a workaround.",
    };
  }

  if (lane === "another_system" || !profile || profile.key === "generic_csv") {
    return {
      headline: "Your system doesn't need to be listed",
      body:
        "Export what you want to bring over (clients, leads, or vendors), upload the CSV, and match the columns. We'll check for duplicates and let you review before anything is created in Hello to Cheers.",
    };
  }

  if (hasSourceSpecificAcceleration(profile.key)) {
    return {
      headline: `Moving from ${profile.displayName}`,
      body:
        "Upload an export from this system. We may recognize and organize columns automatically — you can always adjust the mapping before we import.",
    };
  }

  return {
    headline: `Moving from ${profile.displayName}`,
    body:
      "Upload an export from this system. We'll guide you through matching columns and reviewing duplicates — the same careful path every venue uses.",
  };
}

export const MIGRATION_CENTER_INTRO = {
  title: "Bring your business with you",
  body:
    "Some systems let us recognize and organize your information more specifically. If yours isn't listed, you can still bring your data with you — we'll guide you through the best way to move it.",
} as const;

/** History / session label — generic_csv is a first-class path, not a lesser tier. */
export function sourceHistoryLabel(
  profile: SourceProfile | undefined,
  sourceKey: SourceKey,
): string {
  if (sourceKey === "generic_csv") return "Another system";
  return profile?.displayName ?? sourceKey;
}
