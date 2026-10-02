/**
 * Date Hold presentation helpers.
 *
 * Authoritative active state for lead Overview is date_holds.status === "active".
 * Calendar/availability may additionally require unexpired expires_at; that does
 * not change how Overview labels an active row.
 */
import { formatDate } from "@/lib/availability/constants";
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
