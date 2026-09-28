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

/** Place-hold CTA is only for leads with no active hold. */
export function shouldShowPlaceHoldCta(holds: readonly DateHold[]): boolean {
  return !holds.some(isActiveHold);
}

export function placeHoldCtaLabel(desiredDefault: string): string {
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
