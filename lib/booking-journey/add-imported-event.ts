/**
 * Additional Event on an existing Client.
 *
 * bookClient stays idempotent for a native second call. Imported Events, including the first one on a new
 * Client, use insertImportedBookedEvent so today's date is not stored as
 * the original booking date and no Lead is invented.
 */
import type { createClient } from "@/integrations/supabase/server";
import { occupancyFailureFromUnknown, calendarBlockFailureFromUnknown } from "@/lib/availability/event-occupancy";
import {
  findDuplicateImportedEvent,
  importedEventDisplayName,
  type ImportedBookingKind,
} from "@/lib/import/client-event-commit";
import { insertImportedBookedEvent } from "@/lib/booking-journey/import-booked-event";
import * as eventsRepo from "@/lib/events/repository";
import type { ClientInput } from "@/lib/clients/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type AddImportedEventResult =
  | { ok: true; eventId: string; duplicate: boolean }
  | { ok: false; message: string };

export async function addImportedEventToClient(
  supabase: DbClient,
  opts: {
    venueId: string;
    clientId: string;
    input: ClientInput;
    kind: ImportedBookingKind;
    eventDate: string;
    eventName?: string;
    /** Venue confirmed an additional Event. Same date is allowed; occupancy still applies. */
    allowAdditional?: boolean;
  },
): Promise<AddImportedEventResult> {
  const eventName = opts.eventName?.trim() || importedEventDisplayName(opts.input);
  const existing = await eventsRepo.listEventsForClient(supabase, opts.venueId, opts.clientId);
  const duplicate = findDuplicateImportedEvent(existing, opts.eventDate);
  if (duplicate && !opts.allowAdditional) {
    return { ok: true, eventId: duplicate.id, duplicate: true };
  }

  try {
    const eventId = await insertImportedBookedEvent(supabase, {
      venueId: opts.venueId,
      clientId: opts.clientId,
      input: opts.input,
      kind: opts.kind,
      eventDate: opts.eventDate,
      eventName,
    });
    return { ok: true, eventId, duplicate: false };
  } catch (err) {
    const fail = occupancyFailureFromUnknown(err) ?? calendarBlockFailureFromUnknown(err);
    return { ok: false, message: fail?.message ?? (err instanceof Error ? err.message : "Could not add this event.") };
  }
}
