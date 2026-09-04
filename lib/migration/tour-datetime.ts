/**
 * Migration tour scheduled-time safety.
 *
 * book_tour_for_migration's own doc comment invites "ISO timestamp or
 * YYYY-MM-DD HH:MM" — the second form has no timezone at all, and was
 * being handed straight to Postgres's own `timestamptz` cast, which
 * resolves a bare string using the DB session's timezone, not the
 * venue's (exactly the bug lib/venue/timezone.ts already exists to fix
 * for every other tour_appointments.scheduled_at writer — see that
 * file's header comment). A wrong resolution near a venue's local
 * midnight can silently flip which side of "now" a tour lands on,
 * which is what actually decides the live/historical bypass inside the
 * RPC — so an ambiguous or malformed input must never reach it.
 *
 * This never decides what "historical" means (that stays exactly
 * book_tour_for_migration's own `p_slot_start < now()` check, unchanged);
 * it only ensures the instant handed to that check is the one the venue's
 * source data actually meant.
 */

const EXPLICIT_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const BARE_LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

function isValidCalendarDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const check = new Date(Date.UTC(y, mo - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d;
}

function isValidTime(h: number, mi: number, s: number): boolean {
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 && s >= 0 && s <= 59;
}

export type ResolvedTourDateTime =
  | { ok: true; iso: string }
  | { ok: false; error: string };

/**
 * Resolves a migration source row's tour scheduledAt string to an
 * unambiguous UTC instant, or refuses cleanly. Two accepted shapes:
 *   1. A full ISO-8601 timestamp with an explicit offset or "Z" — already
 *      unambiguous, validated and passed through.
 *   2. A bare "YYYY-MM-DD HH:MM[:SS]" (date + time, no zone) — treated as
 *      the venue's own local wall-clock time (matching what the CSV
 *      template already promises) and converted via the same
 *      venueLocalToUtcIso double-conversion every other tour writer uses.
 * Anything else — missing time component, garbage text, an
 * out-of-range calendar date/time — is refused, never guessed.
 */
export function resolveMigrationTourScheduledAt(
  scheduledAt: string,
  timezone: string | null,
  venueLocalToUtcIso: (dateStr: string, timeStr: string, timezone: string | null) => string,
): ResolvedTourDateTime {
  const trimmed = scheduledAt.trim();

  const explicit = trimmed.match(EXPLICIT_OFFSET);
  if (explicit) {
    const [, y, mo, d, h, mi, s] = explicit;
    if (!isValidCalendarDate(Number(y), Number(mo), Number(d)) || !isValidTime(Number(h), Number(mi), Number(s ?? "0"))) {
      return { ok: false, error: `Tour date "${scheduledAt}" is not a valid calendar date/time.` };
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: `Tour date "${scheduledAt}" could not be read as a timestamp.` };
    }
    return { ok: true, iso: parsed.toISOString() };
  }

  const bareLocal = trimmed.match(BARE_LOCAL);
  if (bareLocal) {
    const [, y, mo, d, h, mi, s] = bareLocal;
    if (!isValidCalendarDate(Number(y), Number(mo), Number(d)) || !isValidTime(Number(h), Number(mi), Number(s ?? "0"))) {
      return { ok: false, error: `Tour date "${scheduledAt}" is not a valid calendar date/time.` };
    }
    const dateStr = `${y}-${mo}-${d}`;
    const timeStr = `${h}:${mi}`;
    return { ok: true, iso: venueLocalToUtcIso(dateStr, timeStr, timezone) };
  }

  return {
    ok: false,
    error: `Tour date "${scheduledAt}" is ambiguous or malformed — use an ISO timestamp with a timezone (e.g. 2027-06-12T14:00:00-04:00) or the venue's local date and time (e.g. 2027-06-12 14:00).`,
  };
}
