/**
 * Day-of Sheet identity line under the couple/event name.
 * Event type + guest count only — schedule times live in the timeline below.
 * Do not label event.startTime as "ceremony"; occupancy start is often Getting Ready.
 */

import { eventTypeLabel } from "@/lib/leads/constants";

export function buildDaySheetHeaderSummary(input: {
  eventType: string | null | undefined;
  guestCount: number | null | undefined;
}): string {
  return [
    input.eventType ? eventTypeLabel(input.eventType) : null,
    input.guestCount != null ? `${input.guestCount.toLocaleString()} guests` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
