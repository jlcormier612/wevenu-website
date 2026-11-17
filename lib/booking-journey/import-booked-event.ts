/**
 * Imported booked Event.
 *
 * Does not use the native booking transaction. That path stamps today's booking date
 * and can invent or retarget a Lead. Import keeps the source booking date
 * when the file has one, and leaves it unknown otherwise.
 */
import type { createClient } from "@/integrations/supabase/server";
import { importedEventDisplayName, type ImportedBookingKind } from "@/lib/import/client-event-commit";
import type { ClientInput } from "@/lib/clients/types";
import * as eventsRepo from "@/lib/events/repository";
import { isoDateOrNull } from "@/lib/reporting/performance-dates";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export function knownOriginalBookingDate(value: string | null | undefined): string | null {
  return isoDateOrNull(value);
}

export async function insertImportedBookedEvent(
  supabase: DbClient,
  opts: {
    venueId: string;
    clientId: string;
    input: ClientInput;
    kind: ImportedBookingKind;
    eventDate: string;
    eventName?: string;
  },
): Promise<string> {
  const eventName = opts.eventName?.trim() || importedEventDisplayName(opts.input);
  const originalBookedOn = knownOriginalBookingDate(opts.input.originalBookedOn);
  const eventId = await eventsRepo.insertEvent(
    supabase,
    opts.venueId,
    {
      name: eventName,
      eventType: opts.input.eventType,
      eventDate: opts.eventDate,
      eventEndDate: opts.input.endDate,
      startTime: opts.input.ceremonyTime,
      endTime: opts.input.receptionTime,
      setupTime: opts.input.setupTime,
      teardownTime: opts.input.teardownTime,
      guestCount: opts.input.guestCount,
      guaranteedGuestCount: "",
      clientId: opts.clientId,
      spaceId: opts.input.spaceId,
    },
    {
      status: opts.kind === "historical" ? "complete" : "confirmed",
    },
  );
  await eventsRepo.stampOriginalBookingDate(supabase, opts.venueId, eventId, originalBookedOn);
  if (opts.kind === "upcoming") {
    try {
      const { inheritSetupProfileForNewEvent } = await import("@/lib/event-setup/inherit");
      await inheritSetupProfileForNewEvent(supabase, opts.venueId, eventId);
    } catch (err) {
      console.error("Setup profile inheritance failed:", err);
    }
  }
  return eventId;
}
