/**
 * Timeline P1a — timing provenance and eligibility.
 * Does not apply date changes, release snapshots, or template replacement.
 * Null day/clock intent means unknown legacy: do not infer fixed or relative.
 */

import { addDaysToIsoDate, resolveEntryTimeFromOffset } from "@/lib/timeline/constants";
import type { TimelineDayAnchor } from "@/lib/timeline/timing-presentation";

export type TimingDayIntent = "relative" | "fixed" | "unknown";
export type TimingClockIntent = "relative" | "explicit" | "untimed" | "unknown";
export type TimingAttention = "missing_event_end" | "invalid_event_end" | "unknown_intent";

export type WeddingEndStatus = "valid" | "missing" | "invalid";

/** Persisted timing intent. Null fields are unknown — never a guessed mode. */
export type TimingProvenance = {
  dayIntent: TimingDayIntent | null;
  dayAnchor: TimelineDayAnchor | null;
  /** Authored relative day offset (template or venue-adjusted). Not a baked start day. */
  relativeDayOffset: number | null;
  dayOffsetOverridden: boolean;
  templateDayOffset: number | null;
  templateDayAnchor: TimelineDayAnchor | null;
  /** YYYY-MM-DD when dayIntent is fixed. */
  fixedDate: string | null;
  clockIntent: TimingClockIntent | null;
  relativeMinutes: number | null;
  clockOverridden: boolean;
  attention: TimingAttention | null;
};

export type TimingWrite = TimingProvenance & {
  /** Start-relative display offset. Unchanged when resolution is blocked. */
  dayOffset: number;
  /** HH:MM or null. Not rebaked unless the caller already holds an explicit clock. */
  entryTime: string | null;
};

export const EMPTY_TIMING: TimingProvenance = {
  dayIntent: null,
  dayAnchor: null,
  relativeDayOffset: null,
  dayOffsetOverridden: false,
  templateDayOffset: null,
  templateDayAnchor: null,
  fixedDate: null,
  clockIntent: null,
  relativeMinutes: null,
  clockOverridden: false,
  attention: "unknown_intent",
};

export function weddingEndDateStatus(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): WeddingEndStatus {
  if (!eventEndDate || !String(eventEndDate).trim()) return "missing";
  if (!eventDate || !String(eventDate).trim()) return "missing";
  if (eventEndDate < eventDate) return "invalid";
  return "valid";
}

export function attentionForEndStatus(status: WeddingEndStatus): TimingAttention | null {
  if (status === "missing") return "missing_event_end";
  if (status === "invalid") return "invalid_event_end";
  return null;
}

/** Inclusive day span from start to a valid end. Same-day end is span 0. */
export function eventSpanDays(eventDate: string, eventEndDate: string): number {
  const start = new Date(`${eventDate}T12:00:00`);
  const end = new Date(`${eventEndDate}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Resolve an end- or start-anchored template offset to a start-relative day.
 * Missing or invalid end dates do not fall back to start-relative timing.
 */
export function resolveAnchoredDayOffset(
  dayOffset: number,
  anchor: TimelineDayAnchor,
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): { ok: true; dayOffset: number } | { ok: false; attention: TimingAttention } {
  const n = Math.trunc(dayOffset);
  if (anchor !== "event_end") return { ok: true, dayOffset: n };
  const status = weddingEndDateStatus(eventDate, eventEndDate);
  if (status !== "valid" || !eventDate || !eventEndDate) {
    return { ok: false, attention: attentionForEndStatus(status) ?? "missing_event_end" };
  }
  return { ok: true, dayOffset: eventSpanDays(eventDate, eventEndDate) + n };
}

export function isUnknownDayIntent(intent: TimingDayIntent | null | undefined): boolean {
  return intent == null || intent === "unknown";
}

export function isUnknownClockIntent(intent: TimingClockIntent | null | undefined): boolean {
  return intent == null || intent === "unknown";
}

/** Offset a future recalculation must keep. Venue adjustment wins over the template default. */
export function relativeDayOffsetForRecalc(timing: TimingProvenance, displayDayOffset: number): number | null {
  if (isUnknownDayIntent(timing.dayIntent)) return null;
  if (timing.dayIntent !== "relative") return null;
  if (timing.relativeDayOffset != null) return timing.relativeDayOffset;
  if (timing.dayOffsetOverridden) return displayDayOffset;
  return timing.templateDayOffset;
}

/**
 * Setup-editor Save all sends a display day and clock and no timing choice.
 * Unknown intent stays unknown. Fixed and end-anchored days are not moved.
 * A start-anchored relative day edit records an override. A clock edit is
 * never stored as a relative clock.
 */
export function timingColumnsForUntypedDisplaySave(
  current: {
    dayIntent: TimingDayIntent | null;
    dayAnchor: TimelineDayAnchor | null;
    clockIntent: TimingClockIntent | null;
    dayOffset: number;
    entryTime: string | null;
  },
  next: { dayOffset: number; entryTime: string | null },
): { dayOffset: number; entryTime: string | null; timingColumns: Record<string, unknown> } {
  const timingColumns: Record<string, unknown> = {};
  let dayOffset = next.dayOffset;
  const entryTime = next.entryTime;

  if (current.dayIntent === "fixed" || (current.dayIntent === "relative" && current.dayAnchor === "event_end")) {
    dayOffset = current.dayOffset;
  } else if (current.dayIntent === "relative" && current.dayAnchor === "event_start" && dayOffset !== current.dayOffset) {
    timingColumns.timing_relative_day_offset = dayOffset;
    timingColumns.timing_day_offset_overridden = true;
  }

  const prevTime = current.entryTime;
  if (current.clockIntent === "relative" && entryTime !== prevTime) {
    timingColumns.timing_clock_overridden = true;
    timingColumns.timing_relative_minutes = null;
    timingColumns.timing_clock_intent = entryTime ? "explicit" : "untimed";
  } else if (
    (current.clockIntent === "explicit" || current.clockIntent === "untimed")
    && entryTime !== prevTime
  ) {
    timingColumns.timing_clock_overridden = true;
    timingColumns.timing_relative_minutes = null;
    timingColumns.timing_clock_intent = entryTime ? "explicit" : "untimed";
  }

  return { dayOffset, entryTime, timingColumns };
}

export function clockRecalcEligible(timing: TimingProvenance): boolean {
  return timing.clockIntent === "relative"
    && !timing.clockOverridden
    && timing.relativeMinutes != null;
}

export type DateChangeProjection = {
  eligible: boolean;
  blockedReason:
    | null
    | "shared_schedule"
    | "unknown_intent"
    | "missing_event_end"
    | "invalid_event_end"
    | "not_relative";
  dayOffset: number;
  fixedDate: string | null;
  entryTime: string | null;
  attention: TimingAttention | null;
  /** Relative clock may be recalculated later. P1a does not apply that rebake. */
  clockRecalcEligible: boolean;
};

/**
 * What a future date change would do to a **working** timeline entry.
 * Unknown intent is never guessed. Fixed calendar dates stay on that calendar
 * day (display day_offset is re-anchored to the new wedding start).
 * This function does not write.
 *
 * P1b release snapshots protect the couple-facing schedule. Legacy
 * `sharedWithCouple` is ignored for eligibility — do not block working
 * recalculation based on audience tags. Callers should surface
 * "on the couple's last shared timeline" separately when an entry id is in
 * the active release snapshot.
 */
export function projectTimingAfterEventDateChange(
  timing: TimingProvenance,
  display: { dayOffset: number; entryTime: string | null },
  change: {
    previousEventDate: string;
    nextEventDate: string;
    nextEndDate: string | null;
    /** @deprecated Ignored after P1b. Couple protection is release snapshots. */
    sharedWithCouple?: boolean;
  },
): DateChangeProjection {
  void change.sharedWithCouple;
  void change.previousEventDate;
  const held: DateChangeProjection = {
    eligible: false,
    blockedReason: null,
    dayOffset: display.dayOffset,
    fixedDate: timing.fixedDate,
    entryTime: display.entryTime,
    attention: timing.attention,
    clockRecalcEligible: false,
  };

  if (isUnknownDayIntent(timing.dayIntent)) {
    return { ...held, blockedReason: "unknown_intent", attention: timing.attention ?? "unknown_intent" };
  }
  if (timing.dayIntent === "fixed") {
    const fixed = timing.fixedDate;
    if (!fixed) {
      return { ...held, blockedReason: "unknown_intent", attention: "unknown_intent" };
    }
    const start = new Date(`${change.nextEventDate}T12:00:00`);
    const pinned = new Date(`${fixed}T12:00:00`);
    const dayOffset = Math.round((pinned.getTime() - start.getTime()) / 86_400_000);
    return {
      eligible: true,
      blockedReason: null,
      dayOffset,
      fixedDate: fixed,
      entryTime: display.entryTime,
      attention: null,
      clockRecalcEligible: false,
    };
  }

  const offset = relativeDayOffsetForRecalc(timing, display.dayOffset);
  if (offset == null || !timing.dayAnchor) {
    return { ...held, blockedReason: "unknown_intent", attention: "unknown_intent" };
  }
  const resolved = resolveAnchoredDayOffset(offset, timing.dayAnchor, change.nextEventDate, change.nextEndDate);
  if (!resolved.ok) {
    return {
      ...held,
      blockedReason: resolved.attention === "invalid_event_end" ? "invalid_event_end" : "missing_event_end",
      attention: resolved.attention,
    };
  }
  return {
    eligible: true,
    blockedReason: null,
    dayOffset: resolved.dayOffset,
    fixedDate: null,
    entryTime: display.entryTime,
    attention: null,
    clockRecalcEligible: clockRecalcEligible(timing),
  };
}

export type DayOfStartProjection = {
  eligible: boolean;
  blockedReason: null | "unknown_intent" | "not_relative_clock" | "missing_day_of_start" | "out_of_range";
  entryTime: string | null;
  attention: TimingAttention | null;
};

/**
 * What a Day-of start-time change would do to a working entry's clock.
 * Only relative, non-overridden clocks with retained minutes are eligible.
 * Fixed/explicit/unknown clocks are never guessed. Does not write.
 */
export function projectClockAfterDayOfStartChange(
  timing: TimingProvenance,
  display: { entryTime: string | null },
  change: { nextStartTime: string | null },
): DayOfStartProjection {
  if (!clockRecalcEligible(timing)) {
    if (isUnknownClockIntent(timing.clockIntent)) {
      return {
        eligible: false,
        blockedReason: "unknown_intent",
        entryTime: display.entryTime,
        attention: timing.attention ?? "unknown_intent",
      };
    }
    return {
      eligible: false,
      blockedReason: "not_relative_clock",
      entryTime: display.entryTime,
      attention: null,
    };
  }
  if (!change.nextStartTime || !String(change.nextStartTime).trim()) {
    return {
      eligible: false,
      blockedReason: "missing_day_of_start",
      entryTime: display.entryTime,
      attention: null,
    };
  }
  const next = resolveEntryTimeFromOffset(timing.relativeMinutes, change.nextStartTime);
  if (next == null) {
    return {
      eligible: false,
      blockedReason: "out_of_range",
      entryTime: display.entryTime,
      attention: null,
    };
  }
  return {
    eligible: true,
    blockedReason: null,
    entryTime: next,
    attention: null,
  };
}

/** Calendar date a fixed item must keep when the wedding start moves. */
export function fixedCalendarDateUnchanged(
  fixedDate: string,
  previousEventDate: string,
  nextEventDate: string,
): { fixedDate: string; previousDisplay: string; nextDisplay: string } {
  return {
    fixedDate,
    previousDisplay: fixedDate,
    nextDisplay: addDaysToIsoDate(nextEventDate, Math.round(
      (new Date(`${fixedDate}T12:00:00`).getTime() - new Date(`${nextEventDate}T12:00:00`).getTime()) / 86_400_000,
    )),
  };
}

export function provenanceFromTemplateApply(input: {
  dayOffset: number;
  dayAnchor: TimelineDayAnchor;
  timeOfDay: string | null;
  minutesOffset: number | null;
  eventDate: string | null;
  eventEndDate: string | null;
  eventStartTime: string | null;
  /** Display day to keep when end resolution is blocked. */
  preserveDayOffset?: number | null;
}): TimingWrite {
  const anchor = input.dayAnchor;
  const authored = Math.trunc(input.dayOffset);
  const resolved = resolveAnchoredDayOffset(authored, anchor, input.eventDate, input.eventEndDate);
  const dayOffset = resolved.ok
    ? resolved.dayOffset
    : (input.preserveDayOffset ?? 0);

  let clockIntent: TimingClockIntent = "untimed";
  let relativeMinutes: number | null = null;
  let entryTime: string | null = null;
  if (input.timeOfDay && input.timeOfDay.trim()) {
    clockIntent = "explicit";
    entryTime = input.timeOfDay.slice(0, 5);
  } else if (input.minutesOffset != null) {
    clockIntent = "relative";
    relativeMinutes = input.minutesOffset;
    entryTime = resolveEntryTimeFromOffset(input.minutesOffset, input.eventStartTime);
  }

  return {
    dayIntent: "relative",
    dayAnchor: anchor,
    relativeDayOffset: authored,
    dayOffsetOverridden: false,
    templateDayOffset: authored,
    templateDayAnchor: anchor,
    fixedDate: null,
    clockIntent,
    relativeMinutes,
    clockOverridden: false,
    attention: resolved.ok ? null : resolved.attention,
    dayOffset,
    entryTime,
  };
}

/** Venue chooses relative or fixed. Does not guess when choice is omitted. */
export function provenanceFromVenueChoice(input: {
  choice: "relative" | "fixed";
  dayAnchor: TimelineDayAnchor;
  relativeDayOffset: number;
  templateDayOffset: number | null;
  templateDayAnchor: TimelineDayAnchor | null;
  fixedDate: string | null;
  eventDate: string | null;
  eventEndDate: string | null;
  previousDayOffset: number;
  clockIntent: TimingClockIntent | null;
  relativeMinutes: number | null;
  explicitEntryTime: string | null;
  clockOverridden: boolean;
}): TimingWrite {
  const overridden = input.templateDayOffset != null && input.relativeDayOffset !== input.templateDayOffset;
  if (input.choice === "fixed") {
    const fixed = input.fixedDate;
    return {
      dayIntent: "fixed",
      dayAnchor: null,
      relativeDayOffset: null,
      dayOffsetOverridden: false,
      templateDayOffset: input.templateDayOffset,
      templateDayAnchor: input.templateDayAnchor,
      fixedDate: fixed,
      clockIntent: input.clockIntent,
      relativeMinutes: input.clockIntent === "relative" ? input.relativeMinutes : null,
      clockOverridden: input.clockOverridden || input.clockIntent === "explicit",
      attention: fixed ? null : "unknown_intent",
      dayOffset: input.previousDayOffset,
      entryTime: input.explicitEntryTime,
    };
  }
  const resolved = resolveAnchoredDayOffset(
    input.relativeDayOffset,
    input.dayAnchor,
    input.eventDate,
    input.eventEndDate,
  );
  return {
    dayIntent: "relative",
    dayAnchor: input.dayAnchor,
    relativeDayOffset: input.relativeDayOffset,
    dayOffsetOverridden: overridden,
    templateDayOffset: input.templateDayOffset,
    templateDayAnchor: input.templateDayAnchor,
    fixedDate: null,
    clockIntent: input.clockIntent,
    relativeMinutes: input.clockIntent === "relative" ? input.relativeMinutes : null,
    clockOverridden: input.clockOverridden || input.clockIntent === "explicit",
    attention: resolved.ok ? null : resolved.attention,
    dayOffset: resolved.ok ? resolved.dayOffset : input.previousDayOffset,
    entryTime: input.explicitEntryTime,
  };
}

export function timingDbColumns(write: TimingWrite): Record<string, unknown> {
  return {
    day_offset: write.dayOffset,
    entry_time: write.entryTime,
    timing_day_intent: write.dayIntent,
    timing_day_anchor: write.dayAnchor,
    timing_relative_day_offset: write.relativeDayOffset,
    timing_day_offset_overridden: write.dayOffsetOverridden,
    timing_template_day_offset: write.templateDayOffset,
    timing_template_day_anchor: write.templateDayAnchor,
    timing_fixed_date: write.fixedDate,
    timing_clock_intent: write.clockIntent,
    timing_relative_minutes: write.relativeMinutes,
    timing_clock_overridden: write.clockOverridden,
    timing_attention: write.attention,
  };
}
