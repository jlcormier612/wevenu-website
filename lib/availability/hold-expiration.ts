/**
 * Hold expiration instants.
 *
 * A venue-chosen expiration date means the end of that calendar date in the
 * venue's configured timezone. Date-only input is converted here. A full
 * timestamp is stored as given so existing expires_at values are not
 * reinterpreted.
 */
import { venueLocalToUtcIso } from "@/lib/venue/timezone";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function holdExpirationInstant(
  raw: string | null | undefined,
  timezone: string | null,
): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (DATE_ONLY.test(trimmed)) {
    // venueLocalToUtcIso keeps hour and minute. End of the venue day is 23:59:59.
    const minute = venueLocalToUtcIso(trimmed, "23:59", timezone);
    return new Date(Date.parse(minute) + 59_000).toISOString();
  }
  return trimmed;
}
