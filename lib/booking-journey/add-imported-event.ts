/**
 * Additional Event on an existing Client.
 *
 * bookClient stays idempotent for the first Booked Event. This path is only
 * for a distinct date that is not already on the client. Upcoming inserts
 * still run occupancy (events insert trigger). Historical complete events
 * do not inherit Setup Profiles.
 */
import type { createClient } from "@/integrations/supabase/server";
import { occupancyFailureFromUnknown, calendarBlockFailureFromUnknown } from "@/lib/availability/event-occupancy";
import {
  findDuplicateImportedEvent,
  importedEventDisplayName,
  type ImportedBookingKind,
} from "@/lib/import/client-event-commit";
import * as eventsRepo from "@/lib/events/repository";
import type { ClientInput } from "@/lib/clients/types";
import { utcTodayIso } from "@/lib/migration/historical-record";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type AddImportedEventResult =
  | { ok: true; eventId: string; duplicate: boolean }
  | { ok: false; message: string };

function eventInputFromClient(clientId: string, input: ClientInput, eventDate: string) {
  return {
    name: importedEventDisplayName(input),
    eventType: input.eventType,
    eventDate,
    eventEndDate: input.endDate,
    startTime: input.ceremonyTime,
    endTime: input.receptionTime,
    setupTime: input.setupTime,
    teardownTime: input.teardownTime,
    guestCount: input.guestCount,
    guaranteedGuestCount: "",
    clientId,
    spaceId: input.spaceId,
  };
}

export async function addImportedEventToClient(
  supabase: DbClient,
  opts: {
    venueId: string;
    clientId: string;
    input: ClientInput;
    kind: ImportedBookingKind;
    eventDate: string;
    eventName?: string;
  },
): Promise<AddImportedEventResult> {
  const eventName = opts.eventName?.trim() || importedEventDisplayName(opts.input);
  const existing = await eventsRepo.listEventsForClient(supabase, opts.venueId, opts.clientId);
  const duplicate = findDuplicateImportedEvent(existing, opts.eventDate);
  if (duplicate) {
    return { ok: true, eventId: duplicate.id, duplicate: true };
  }

  if (opts.kind === "upcoming" && existing.length === 0) {
    const { bookClient } = await import("@/lib/booking-journey/book-client");
    const booked = await bookClient(supabase, {
      venueId: opts.venueId,
      clientId: opts.clientId,
      source: "manual",
      spaceId: opts.input.spaceId,
      lifecycleOrigin: "import",
      event: {
        name: eventName,
        eventType: opts.input.eventType,
        eventDate: opts.eventDate,
        eventEndDate: opts.input.endDate,
        startTime: opts.input.ceremonyTime,
        endTime: opts.input.receptionTime,
        setupTime: opts.input.setupTime,
        teardownTime: opts.input.teardownTime,
        guestCount: opts.input.guestCount,
      },
    });
    if (!booked.ok) return { ok: false, message: booked.message };
    return { ok: true, eventId: booked.eventId, duplicate: false };
  }

  try {
    const eventId = await eventsRepo.insertEvent(
      supabase,
      opts.venueId,
      { ...eventInputFromClient(opts.clientId, opts.input, opts.eventDate), name: eventName },
      opts.kind === "historical"
        ? { status: "complete", bookedAt: opts.eventDate }
        : { status: "confirmed", bookedAt: utcTodayIso() },
    );
    if (opts.kind === "upcoming") {
      try {
        const { inheritSetupProfileForNewEvent } = await import("@/lib/event-setup/inherit");
        await inheritSetupProfileForNewEvent(supabase, opts.venueId, eventId);
      } catch (err) {
        console.error("Setup profile inheritance failed:", err);
      }
    }
    return { ok: true, eventId, duplicate: false };
  } catch (err) {
    const fail = occupancyFailureFromUnknown(err) ?? calendarBlockFailureFromUnknown(err);
    return { ok: false, message: fail?.message ?? (err instanceof Error ? err.message : "Could not add this event.") };
  }
}
