/**
 * Timeline P1c — preview and confirm for T4 (event date) and T7 (Day-of start).
 * Working entries only. Never mutates venue_timeline_releases or the active pointer.
 */

import { createHash } from "node:crypto";

import {
  EMPTY_TIMING,
  projectClockAfterDayOfStartChange,
  projectTimingAfterEventDateChange,
  type DateChangeProjection,
  type DayOfStartProjection,
  type TimingProvenance,
} from "@/lib/timeline/timing-provenance";
import type { TimelineEntry } from "@/lib/timeline/types";

export type TimingRecalcKind = "date" | "day_of_start";

export type TimingRecalcRow = {
  entryId: string;
  title: string;
  kind: TimingRecalcKind;
  /** Entry appears in the active couple release snapshot (informational). */
  inActiveRelease: boolean;
  currentDayOffset: number;
  currentEntryTime: string | null;
  proposedDayOffset: number;
  proposedEntryTime: string | null;
  dayIntent: TimingProvenance["dayIntent"];
  clockIntent: TimingProvenance["clockIntent"];
  eligible: boolean;
  blockedReason: string | null;
  attention: TimingProvenance["attention"];
  summary: string;
};

export type TimingRecalcPreview = {
  eventId: string;
  kinds: TimingRecalcKind[];
  fingerprint: string;
  nextEventDate: string;
  nextEndDate: string | null;
  nextStartTime: string | null;
  previousEventDate: string;
  previousEndDate: string | null;
  previousStartTime: string | null;
  rows: TimingRecalcRow[];
  eligibleCount: number;
  reviewCount: number;
  unchangedCount: number;
  hasActiveRelease: boolean;
};

function entryTiming(entry: TimelineEntry): TimingProvenance {
  return entry.timing ?? { ...EMPTY_TIMING };
}

function dateSummary(proj: DateChangeProjection, entry: TimelineEntry): string {
  if (proj.eligible) {
    if (entry.timing?.dayIntent === "fixed") {
      return `Fixed calendar date stays ${proj.fixedDate}; display day updates to match the new wedding start.`;
    }
    if (proj.dayOffset === entry.dayOffset && proj.entryTime === entry.entryTime) {
      return "Relative timing already matches the new wedding dates.";
    }
    return `Relative day moves from day ${entry.dayOffset} to day ${proj.dayOffset}.`;
  }
  if (proj.blockedReason === "unknown_intent") {
    return "Timing intent is unknown — choose relative or fixed on the Timeline before recalculating.";
  }
  if (proj.blockedReason === "missing_event_end") {
    return "This item is tied to the wedding end date, which is missing — set a valid end date or edit the item.";
  }
  if (proj.blockedReason === "invalid_event_end") {
    return "This item is tied to the wedding end date, which is invalid — fix the end date or edit the item.";
  }
  return "This item needs a venue decision before its day can be recalculated.";
}

function clockSummary(proj: DayOfStartProjection, entry: TimelineEntry): string {
  if (proj.eligible) {
    if (proj.entryTime === entry.entryTime) {
      return "Relative clock already matches the new Day-of start.";
    }
    return `Relative clock moves from ${entry.entryTime ?? "untimed"} to ${proj.entryTime}.`;
  }
  if (proj.blockedReason === "unknown_intent") {
    return "Clock timing intent is unknown — set relative minutes or a fixed clock on the Timeline.";
  }
  if (proj.blockedReason === "missing_day_of_start") {
    return "Day-of schedule start is missing — set it on the event before recalculating relative clocks.";
  }
  if (proj.blockedReason === "out_of_range") {
    return "Relative minutes from Day-of start fall outside the same calendar day — edit this item on the Timeline.";
  }
  return "Fixed or manually set clock times stay as they are.";
}

function stableFingerprint(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildTimingRecalcPreview(input: {
  eventId: string;
  entries: TimelineEntry[];
  activeReleaseEntryIds: ReadonlySet<string>;
  hasActiveRelease: boolean;
  previousEventDate: string;
  previousEndDate: string | null;
  previousStartTime: string | null;
  nextEventDate: string;
  nextEndDate: string | null;
  nextStartTime: string | null;
}): TimingRecalcPreview {
  const dateChanged =
    input.previousEventDate !== input.nextEventDate
    || (input.previousEndDate ?? null) !== (input.nextEndDate ?? null);
  const startChanged = (input.previousStartTime ?? null) !== (input.nextStartTime ?? null);

  const kinds: TimingRecalcKind[] = [];
  if (dateChanged) kinds.push("date");
  if (startChanged) kinds.push("day_of_start");

  const rows: TimingRecalcRow[] = [];
  for (const entry of input.entries) {
    if (entry.owner !== "venue") continue;
    const timing = entryTiming(entry);
    const inActiveRelease = input.activeReleaseEntryIds.has(entry.id);

    if (dateChanged) {
      const proj = projectTimingAfterEventDateChange(
        timing,
        { dayOffset: entry.dayOffset, entryTime: entry.entryTime },
        {
          previousEventDate: input.previousEventDate,
          nextEventDate: input.nextEventDate,
          nextEndDate: input.nextEndDate,
        },
      );
      const unchanged = proj.eligible
        && proj.dayOffset === entry.dayOffset
        && (proj.entryTime ?? null) === (entry.entryTime ?? null)
        && (proj.attention ?? null) === (timing.attention ?? null);
      if (!proj.eligible || !unchanged) {
        rows.push({
          entryId: entry.id,
          title: entry.title,
          kind: "date",
          inActiveRelease,
          currentDayOffset: entry.dayOffset,
          currentEntryTime: entry.entryTime,
          proposedDayOffset: proj.dayOffset,
          proposedEntryTime: proj.entryTime,
          dayIntent: timing.dayIntent,
          clockIntent: timing.clockIntent,
          eligible: Boolean(proj.eligible && !unchanged),
          blockedReason: proj.eligible ? null : proj.blockedReason,
          attention: proj.attention,
          summary: dateSummary(proj, entry),
        });
      }
    }

    if (startChanged) {
      const proj = projectClockAfterDayOfStartChange(
        timing,
        { entryTime: entry.entryTime },
        { nextStartTime: input.nextStartTime },
      );
      const unchanged = proj.eligible && (proj.entryTime ?? null) === (entry.entryTime ?? null);
      if (proj.eligible && !unchanged) {
        rows.push({
          entryId: entry.id,
          title: entry.title,
          kind: "day_of_start",
          inActiveRelease,
          currentDayOffset: entry.dayOffset,
          currentEntryTime: entry.entryTime,
          proposedDayOffset: entry.dayOffset,
          proposedEntryTime: proj.entryTime,
          dayIntent: timing.dayIntent,
          clockIntent: timing.clockIntent,
          eligible: true,
          blockedReason: null,
          attention: proj.attention,
          summary: clockSummary(proj, entry),
        });
      } else if (!proj.eligible && (proj.blockedReason === "unknown_intent" || proj.blockedReason === "missing_day_of_start" || proj.blockedReason === "out_of_range")) {
        rows.push({
          entryId: entry.id,
          title: entry.title,
          kind: "day_of_start",
          inActiveRelease,
          currentDayOffset: entry.dayOffset,
          currentEntryTime: entry.entryTime,
          proposedDayOffset: entry.dayOffset,
          proposedEntryTime: entry.entryTime,
          dayIntent: timing.dayIntent,
          clockIntent: timing.clockIntent,
          eligible: false,
          blockedReason: proj.blockedReason,
          attention: proj.attention,
          summary: clockSummary(proj, entry),
        });
      }
    }
  }

  const eligibleCount = rows.filter((r) => r.eligible).length;
  const reviewCount = rows.filter((r) => !r.eligible).length;
  const fingerprint = stableFingerprint({
    eventId: input.eventId,
    kinds,
    nextEventDate: input.nextEventDate,
    nextEndDate: input.nextEndDate,
    nextStartTime: input.nextStartTime,
    rows: rows.map((r) => ({
      entryId: r.entryId,
      kind: r.kind,
      eligible: r.eligible,
      proposedDayOffset: r.proposedDayOffset,
      proposedEntryTime: r.proposedEntryTime,
      blockedReason: r.blockedReason,
      attention: r.attention,
      currentDayOffset: r.currentDayOffset,
      currentEntryTime: r.currentEntryTime,
    })),
  });

  return {
    eventId: input.eventId,
    kinds,
    fingerprint,
    nextEventDate: input.nextEventDate,
    nextEndDate: input.nextEndDate,
    nextStartTime: input.nextStartTime,
    previousEventDate: input.previousEventDate,
    previousEndDate: input.previousEndDate,
    previousStartTime: input.previousStartTime,
    rows,
    eligibleCount,
    reviewCount,
    unchangedCount: Math.max(0, input.entries.filter((e) => e.owner === "venue").length - rows.length),
    hasActiveRelease: input.hasActiveRelease,
  };
}

/** Patches to apply for one eligible row (working entry only). */
export function workingPatchForRecalcRow(
  row: TimingRecalcRow,
  timing: TimingProvenance,
): { dayOffset: number; entryTime: string | null; timing: TimingProvenance } | null {
  if (!row.eligible) return null;
  if (row.kind === "date") {
    return {
      dayOffset: row.proposedDayOffset,
      entryTime: row.proposedEntryTime,
      timing: {
        ...timing,
        attention: row.attention,
        // Keep intents; only display day / attention change for relative/fixed.
        fixedDate: timing.dayIntent === "fixed" ? timing.fixedDate : null,
      },
    };
  }
  return {
    dayOffset: row.currentDayOffset,
    entryTime: row.proposedEntryTime,
    timing: {
      ...timing,
      // Relative clock rebake keeps relative minutes intent.
      clockIntent: "relative",
      clockOverridden: false,
      relativeMinutes: timing.relativeMinutes,
      attention: row.attention,
    },
  };
}
