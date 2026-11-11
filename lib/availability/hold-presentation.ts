/**
 * Date Hold presentation helpers.
 *
 * A hold is Held only while status is active and expires_at has not passed.
 * Elapsed rows present as Expired even if a lazy status write has not landed yet.
 */
import { formatDate } from "@/lib/availability/constants";
import { holdCoversDate, holdProtectsAvailability } from "@/lib/availability/hold-occupancy";
import { formatTime } from "@/lib/events/constants";
import type { DateHold, HoldStatus } from "@/lib/availability/types";

export function isActiveHold(hold: { status: HoldStatus; expiresAt?: string | null }): boolean {
  return holdProtectsAvailability(hold);
}

export function activeHolds(holds: readonly DateHold[]): DateHold[] {
  return holds.filter(isActiveHold);
}

export function historicalHolds(holds: readonly DateHold[]): DateHold[] {
  return holds.filter((h) => !isActiveHold(h));
}

/**
 * Place-hold CTA stays available when active holds already exist (another hold, not a replacement).
 * Once the relationship is Booked, occupancy protects the date — do not push Place hold.
 */
export function shouldShowPlaceHoldCta(
  _holds?: readonly DateHold[],
  opts?: { booked?: boolean },
): boolean {
  if (opts?.booked) return false;
  return true;
}

export function placeHoldCtaLabel(desiredDefault: string, hasActiveHolds = false): string {
  if (hasActiveHolds) return "Place another hold";
  return desiredDefault
    ? `Place hold on ${formatDate(desiredDefault)}`
    : "Place Hold";
}

/**
 * Active Holds occupancy window — display only.
 * Stored start_time / end_time stay HH:mm. Null/null is all-day (caller shows "All day").
 * Reuses events formatTime (en-US 12-hour). Same-meridiem ranges collapse the first suffix:
 * 16:00–18:00 → "4:00–6:00 PM".
 */
/** Inclusive date label: single day or "Fri – Sun" style range. */
export function holdDateRangeLabel(hold: Pick<DateHold, "holdDate" | "endDate">): string {
  const end = hold.endDate && hold.endDate >= hold.holdDate ? hold.endDate : hold.holdDate;
  if (end === hold.holdDate) return formatDate(hold.holdDate);
  return `${formatDate(hold.holdDate)} – ${formatDate(end)}`;
}

export function holdWindowLabel(hold: Pick<DateHold, "startTime" | "endTime" | "holdDate" | "endDate">): string | null {
  const end = hold.endDate && hold.endDate >= hold.holdDate ? hold.endDate : (hold.holdDate ?? "");
  const multiDay = Boolean(hold.holdDate && end && end !== hold.holdDate);
  if (!hold.startTime && !hold.endTime) {
    // Legacy single-day callers show their own "All day" copy when null.
    return multiDay ? "All day (date range)" : null;
  }
  const start = formatTime(hold.startTime ?? "00:00");
  const endTime = formatTime(hold.endTime ?? "23:59");
  const startMeridiem = start.endsWith(" AM") ? " AM" : start.endsWith(" PM") ? " PM" : "";
  const endMeridiem = endTime.endsWith(" AM") ? " AM" : endTime.endsWith(" PM") ? " PM" : "";
  if (startMeridiem && startMeridiem === endMeridiem) {
    return `${start.slice(0, -startMeridiem.length)}–${endTime}`;
  }
  return `${start}–${endTime}`;
}

export function historicalHoldLabel(hold: Pick<DateHold, "holdDate" | "endDate" | "status" | "expiresAt">): string {
  const elapsedActive = hold.status === "active" && !holdProtectsAvailability(hold);
  const status =
    elapsedActive || hold.status === "expired"
      ? "Expired (no longer protecting)"
      : hold.status === "released"
        ? "Released (no longer protecting)"
        : hold.status === "converted"
          ? "Converted to booking"
          : hold.status;
  return `${holdDateRangeLabel(hold)} — ${status}`;
}

/** Whether a past hold may be reactivated by editing (not converted). */
export function canReactivateHold(hold: { status: HoldStatus; expiresAt?: string | null }): boolean {
  if (hold.status === "converted") return false;
  if (hold.status === "expired" || hold.status === "released") return true;
  // Elapsed active row still in DB before expire job lands
  return hold.status === "active" && !holdProtectsAvailability(hold);
}

export function currentProtectionSummary(opts: {
  eventDate?: string | null;
  holds: readonly DateHold[];
  /** Booked relationship — date is protected by event occupancy, not a hold. */
  booked?: boolean;
  nowMs?: number;
}): {
  protected: boolean;
  /** What currently protects the date (or none). */
  source: "hold" | "booking" | "none";
  headline: string;
  /** Compact chip label on the lead Sales & availability row. */
  chipLabel: string;
  detail: string | null;
} {
  const active = activeHolds(opts.holds);
  const date = opts.eventDate?.trim() || null;
  const covering = date
    ? active.filter((h) => holdCoversDate(h, date))
    : active;
  if (covering.length > 0) {
    const primary = covering[0]!;
    const release = primary.expiresAt
      ? `Auto-release ${formatDate(primary.expiresAt.slice(0, 10))}`
      : "No auto-release date";
    const scope = primary.spaceNames?.length
      ? primary.spaceNames.join(", ")
      : primary.spaceName
        ? primary.spaceName
        : primary.spaceIds.length === 0
          ? "Whole venue"
          : "Selected spaces";
    return {
      protected: true,
      source: "hold",
      headline: "DATE PROTECTED — HOLD ACTIVE",
      chipLabel: "Held",
      detail: `Event/hold dates: ${holdDateRangeLabel(primary)} · ${scope} · ${release}`,
    };
  }
  if (opts.booked) {
    return {
      protected: true,
      source: "booking",
      headline: "DATE PROTECTED — BOOKING",
      chipLabel: "Protected by booking",
      detail: "This date is reserved by the booked event — a hold isn't needed.",
    };
  }
  return {
    protected: false,
    source: "none",
    headline: "DATE NOT CURRENTLY PROTECTED",
    chipLabel: "Not protected",
    detail: date
      ? "No active hold is protecting this event date right now. Past holds below are history only."
      : "No active hold is protecting a date right now.",
  };
}
