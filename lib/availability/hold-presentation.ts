/**
 * Date Hold presentation helpers.
 *
 * A hold is Held only while status is active and expires_at has not passed.
 * Elapsed rows present as Expired even if a lazy status write has not landed yet.
 */
import { formatDate } from "@/lib/availability/constants";
import { holdProtectsAvailability } from "@/lib/availability/hold-occupancy";
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

export function historicalHoldLabel(hold: Pick<DateHold, "holdDate" | "status" | "expiresAt">): string {
  const elapsedActive = hold.status === "active" && !holdProtectsAvailability(hold);
  const status =
    elapsedActive || hold.status === "expired"
      ? "Expired"
      : hold.status === "released"
        ? "Released"
        : hold.status === "converted"
          ? "Converted"
          : hold.status;
  return `${formatDate(hold.holdDate)} — ${status}`;
}
