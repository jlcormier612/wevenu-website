/**
 * Date Hold presentation helpers.
 *
 * Authoritative active state for lead Overview is date_holds.status === "active".
 * Calendar/availability may additionally require unexpired expires_at; that does
 * not change how Overview labels an active row.
 */
import { formatDate } from "@/lib/availability/constants";
import { formatTime } from "@/lib/events/constants";
import type { DateHold, HoldStatus } from "@/lib/availability/types";

export function isActiveHold(hold: { status: HoldStatus }): boolean {
  return hold.status === "active";
}

export function activeHolds(holds: readonly DateHold[]): DateHold[] {
  return holds.filter(isActiveHold);
}

export function historicalHolds(holds: readonly DateHold[]): DateHold[] {
  return holds.filter((h) => !isActiveHold(h));
}

/** Place-hold CTA stays available when active holds already exist (another hold, not a replacement). */
export function shouldShowPlaceHoldCta(_holds?: readonly DateHold[]): boolean {
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
export function holdWindowLabel(hold: Pick<DateHold, "startTime" | "endTime">): string | null {
  if (!hold.startTime && !hold.endTime) return null;
  const start = formatTime(hold.startTime ?? "00:00");
  const end = formatTime(hold.endTime ?? "23:59");
  const startMeridiem = start.endsWith(" AM") ? " AM" : start.endsWith(" PM") ? " PM" : "";
  const endMeridiem = end.endsWith(" AM") ? " AM" : end.endsWith(" PM") ? " PM" : "";
  if (startMeridiem && startMeridiem === endMeridiem) {
    return `${start.slice(0, -startMeridiem.length)}–${end}`;
  }
  return `${start}–${end}`;
}

export function historicalHoldLabel(hold: Pick<DateHold, "holdDate" | "status">): string {
  const status =
    hold.status === "released"
      ? "Released"
      : hold.status === "expired"
        ? "Expired"
        : hold.status === "converted"
          ? "Converted"
          : hold.status;
  return `${formatDate(hold.holdDate)} — ${status}`;
}
