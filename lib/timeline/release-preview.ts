/**
 * Timeline P1b — G1-A release preview classification (pure).
 * Unresolved = P1a timing_attention needing a venue decision.
 * Never invents title-based importance. Never clears attention to force release.
 */

import { TIMELINE_DAY_PAD } from "@/lib/timeline/constants";
import type { TimingAttention } from "@/lib/timeline/timing-provenance";

export type ReleaseBucket = "will_share" | "held_out" | "blocks_release";

export type ReleasePreviewItem = {
  id: string;
  title: string;
  dayOffset: number;
  entryTime: string | null;
  timingAttention: TimingAttention | null;
  timingDayIntent: string | null;
  timingFixedDate: string | null;
  updatedAt?: string | null;
};

export type ClassifiedReleaseItem = ReleasePreviewItem & {
  bucket: ReleaseBucket;
  reason: string | null;
};

export type SoftWarning = {
  id: string;
  title: string;
  reason: "fixed_outside_planning_pad";
  fixedDate: string;
};

export const UNRESOLVED_ATTENTIONS: ReadonlySet<string> = new Set([
  "unknown_intent",
  "missing_event_end",
  "invalid_event_end",
]);

export function isUnresolvedTimingAttention(
  attention: string | null | undefined,
): boolean {
  return attention != null && UNRESOLVED_ATTENTIONS.has(attention);
}

/** Soft ±14 check — informational only; never a release blocker by itself. */
export function fixedDateOutsidePlanningPad(
  eventDate: string | null | undefined,
  fixedDate: string | null | undefined,
  pad = TIMELINE_DAY_PAD,
): boolean {
  if (!eventDate || !fixedDate) return false;
  const start = new Date(`${eventDate}T12:00:00`);
  const fixed = new Date(`${fixedDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(fixed.getTime())) return false;
  const diffDays = Math.round((fixed.getTime() - start.getTime()) / 86_400_000);
  return Math.abs(diffDays) > pad;
}

/**
 * Classify working venue items against the last successful release entry ids.
 * G1-A: never-released unresolved → held_out; previously released unresolved → blocks.
 * Resolved → will_share. Titles are never used for importance.
 */
export function classifyVenueTimelineReleasePreview(
  working: readonly ReleasePreviewItem[],
  lastReleasedEntryIds: ReadonlySet<string>,
  eventDate: string | null | undefined,
): {
  willShare: ClassifiedReleaseItem[];
  heldOut: ClassifiedReleaseItem[];
  blocksRelease: ClassifiedReleaseItem[];
  softWarnings: SoftWarning[];
  canRelease: boolean;
} {
  const willShare: ClassifiedReleaseItem[] = [];
  const heldOut: ClassifiedReleaseItem[] = [];
  const blocksRelease: ClassifiedReleaseItem[] = [];
  const softWarnings: SoftWarning[] = [];

  for (const item of working) {
    const unresolved = isUnresolvedTimingAttention(item.timingAttention);
    const inLast = lastReleasedEntryIds.has(item.id);

    if (unresolved && inLast) {
      blocksRelease.push({
        ...item,
        bucket: "blocks_release",
        reason: "previously_released_unresolved",
      });
    } else if (unresolved && !inLast) {
      heldOut.push({
        ...item,
        bucket: "held_out",
        reason: "never_released_unresolved",
      });
    } else {
      willShare.push({
        ...item,
        bucket: "will_share",
        reason: null,
      });
    }

    if (
      item.timingDayIntent === "fixed"
      && item.timingFixedDate
      && fixedDateOutsidePlanningPad(eventDate, item.timingFixedDate)
    ) {
      softWarnings.push({
        id: item.id,
        title: item.title,
        reason: "fixed_outside_planning_pad",
        fixedDate: item.timingFixedDate,
      });
    }
  }

  return {
    willShare,
    heldOut,
    blocksRelease,
    softWarnings,
    canRelease: blocksRelease.length === 0 && willShare.length > 0,
  };
}

/** Fingerprint used to reject stale confirmations (must match SQL helper). */
export function workingTimelineFingerprint(
  working: readonly Pick<
    ReleasePreviewItem,
    "id" | "dayOffset" | "entryTime" | "title" | "timingAttention" | "timingFixedDate" | "updatedAt"
  >[],
): string {
  const parts = [...working]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (te) =>
        `${te.id}|${te.updatedAt ?? ""}|${te.dayOffset}|${te.entryTime ?? ""}|${te.title}|${te.timingAttention ?? ""}|${te.timingFixedDate ?? ""}`,
    );
  // Browser-safe md5 substitute: use a stable FNV-1a 32-bit hex for unit tests;
  // server SQL uses md5. Service layer always prefers RPC fingerprint.
  let hash = 0x811c9dc5;
  const s = parts.join(",");
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function holdOutIdsMatch(
  expected: readonly string[],
  acknowledged: readonly string[],
): boolean {
  if (expected.length !== acknowledged.length) return false;
  const a = new Set(expected);
  for (const id of acknowledged) {
    if (!a.has(id)) return false;
  }
  return true;
}
