/**
 * Venue-local ↔ UTC conversion for `timestamptz` columns (`tour_appointments.
 * scheduled_at` and any future caller with the same shape). No timezone
 * library is a dependency of this project — both directions are implemented
 * with `Intl.DateTimeFormat`, the same primitive `lib/notifications/
 * digest-engine.ts`'s `getLocalHour` already uses for the read direction.
 *
 * The bug this exists to fix: reading a `timestamptz` back with
 * `date.toISOString().slice(...)` extracts the UTC wall clock, not the
 * venue's — a tour booked for 10:00 America/New_York (UTC-4 in summer)
 * stores correctly as 14:00 UTC, then displays as "14:00" because nothing
 * ever converted it back. Writing has the mirror-image bug: `new
 * Date("2026-07-15T10:00:00")` (no offset) is parsed in the *server's* local
 * timezone, which is UTC in most deployments — an accident of which machine
 * happens to run the code, not the venue's actual timezone.
 */

const DEFAULT_TIMEZONE = "America/New_York";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getVenueTimezone(client: any, venueId: string): Promise<string | null> {
  const { data } = await client.from("venues").select("timezone").eq("id", venueId).maybeSingle();
  return (data as { timezone: string | null } | null)?.timezone ?? null;
}

/** A stored UTC instant, resolved to the venue's own local date/time for display. */
export function utcToVenueLocalParts(isoTimestamp: string, timezone: string | null): { date: string; time: string } {
  const tz = timezone || DEFAULT_TIMEZONE;
  const instant = new Date(isoTimestamp);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = fmt.formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    // Intl renders midnight as "24" for hour12:false in some engines — normalize.
    const hour = get("hour") === "24" ? "00" : get("hour");
    return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
  } catch {
    return { date: instant.toISOString().slice(0, 10), time: instant.toISOString().slice(11, 16) };
  }
}

/**
 * A venue-local date + time (what a coordinator standing at the venue means
 * by "10:00"), converted to the correct UTC instant for storage.
 *
 * Standard double-conversion technique for converting a local wall-clock
 * time in an IANA zone to UTC without a timezone library: guess the UTC
 * instant is the wall-clock digits taken literally, format that guess back
 * through the target zone to see how far off it reads, then correct by the
 * difference. Correct across DST for all but the (rare, unavoidable without
 * a full tz database) hour spanning a DST transition itself.
 */
export function venueLocalToUtcIso(dateStr: string, timeStr: string, timezone: string | null): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = (timeStr || "12:00").split(":").map(Number);
  if (!y || !mo || !d) return new Date(`${dateStr}T${timeStr || "12:00"}:00`).toISOString();

  try {
    const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = fmt.formatToParts(guess);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
    const hour = get("hour") === "24" ? 0 : Number(get("hour"));
    const readsAs = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), hour, Number(get("minute")));
    const correction = guess.getTime() - readsAs;
    return new Date(guess.getTime() + correction).toISOString();
  } catch {
    return new Date(`${dateStr}T${timeStr || "12:00"}:00`).toISOString();
  }
}
