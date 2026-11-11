/**
 * Server-side accepted event-type checks for new inquiry/lead creation.
 * Historical values on existing records are not rejected merely for being
 * outside the venue's current accepted set.
 */

import {
  normalizeEventType,
  parseAcceptedEventTypes,
} from "@/lib/event-types/canonical";
import { INQUIRY_API_ERRORS } from "@/lib/inquiry-form/constants";

export const EVENT_TYPE_NOT_ACCEPTED_CODE = "event_type_not_accepted" as const;

export const EVENT_TYPE_NOT_ACCEPTED_MESSAGE =
  INQUIRY_API_ERRORS.event_type_not_accepted;

function isAcceptedKey(key: string, accepted: readonly string[]): boolean {
  return accepted.includes(key);
}

/**
 * Gate for creating a new inquiry/lead (manual UI, not historical import).
 * Empty event type is allowed (optional on manual Lead form).
 */
export function assertEventTypeAcceptedForNewRecord(
  eventType: string | null | undefined,
  acceptedRaw: unknown,
):
  | { ok: true; eventType: string | null }
  | { ok: false; code: typeof EVENT_TYPE_NOT_ACCEPTED_CODE; error: string } {
  const trimmed = eventType?.trim() ?? "";
  if (!trimmed) return { ok: true, eventType: null };

  const accepted = parseAcceptedEventTypes(acceptedRaw);
  const canonical = normalizeEventType(trimmed);
  const key = canonical ?? trimmed;

  if (canonical && isAcceptedKey(canonical, accepted)) {
    return { ok: true, eventType: canonical };
  }
  if (!canonical && isAcceptedKey(trimmed, accepted)) {
    return { ok: true, eventType: trimmed };
  }

  return {
    ok: false,
    code: EVENT_TYPE_NOT_ACCEPTED_CODE,
    error: EVENT_TYPE_NOT_ACCEPTED_MESSAGE,
  };
}

/**
 * Edit semantics: keeping the existing (possibly legacy) type is always ok.
 * Changing to a different type requires that new type to be currently accepted.
 */
export function assertEventTypeChangeAllowed(args: {
  previousEventType: string | null | undefined;
  nextEventType: string | null | undefined;
  acceptedRaw: unknown;
}):
  | { ok: true }
  | { ok: false; code: typeof EVENT_TYPE_NOT_ACCEPTED_CODE; error: string } {
  const prevRaw = args.previousEventType?.trim() ?? "";
  const nextRaw = args.nextEventType?.trim() ?? "";
  const prevKey = (normalizeEventType(prevRaw) ?? prevRaw) || "";
  const nextKey = (normalizeEventType(nextRaw) ?? nextRaw) || "";

  if (prevKey === nextKey) return { ok: true };

  const created = assertEventTypeAcceptedForNewRecord(
    args.nextEventType,
    args.acceptedRaw,
  );
  if (!created.ok) return created;
  return { ok: true };
}

/**
 * Holds and Convert-to-Lead placeholders are inquiry-equivalent.
 * A new Hold may only store an accepted event type (blank is allowed).
 * Editing a Hold may keep a legacy stored type, and may not switch to
 * a type the venue does not currently accept.
 * Non-booking schedule items do not persist event type.
 */
export function gateBookingPlaceholderEventType(args: {
  isBooking: boolean;
  mode: "create" | "update";
  previousEventType?: string | null;
  nextEventType: string | null | undefined;
  acceptedRaw: unknown;
}):
  | { ok: true }
  | { ok: false; code: typeof EVENT_TYPE_NOT_ACCEPTED_CODE; error: string } {
  if (!args.isBooking) return { ok: true };
  if (args.mode === "create") {
    const created = assertEventTypeAcceptedForNewRecord(
      args.nextEventType,
      args.acceptedRaw,
    );
    if (!created.ok) return created;
    return { ok: true };
  }
  return assertEventTypeChangeAllowed({
    previousEventType: args.previousEventType,
    nextEventType: args.nextEventType,
    acceptedRaw: args.acceptedRaw,
  });
}
