/**
 * Business-performance dates.
 *
 * Import time, event day, original booking day, and payment dates are
 * different facts. An unknown original date stays null. It is never
 * replaced with the import day or the event day.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoDateOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().slice(0, 10);
  const match = ISO_DATE.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year
    || utc.getUTCMonth() !== month - 1
    || utc.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Period a Lead belongs to in inquiry and conversion reports.
 * Historical imports use the source inquiry date only.
 * Native inquiries keep the HTC creation day.
 */
export function leadPerformanceOn(input: {
  isHistoricalImport?: boolean | null;
  inquiryDate?: string | null;
  createdAt?: string | null;
}): string | null {
  if (input.isHistoricalImport) return isoDateOrNull(input.inquiryDate);
  const created = (input.createdAt ?? "").slice(0, 10);
  return isoDateOrNull(created);
}

export function dateInWindow(
  day: string | null,
  window: { from?: string | null; to?: string | null },
): boolean {
  const bounded = Boolean(window.from || window.to);
  if (!day) return !bounded;
  if (window.from && day < window.from) return false;
  if (window.to && day > window.to) return false;
  return true;
}

/** Active booked events on the dashboard: ahead of today, not cancelled or complete. */
export function isActiveBookedEvent(input: {
  status: string;
  eventDate: string | null | undefined;
  today: string;
}): boolean {
  if (input.status !== "confirmed" && input.status !== "in_progress") return false;
  const day = isoDateOrNull(input.eventDate);
  if (!day) return false;
  return day >= input.today;
}

export function isCancelledEvent(status: string): boolean {
  return status === "cancelled";
}
