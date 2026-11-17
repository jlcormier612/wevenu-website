/**
 * Client migration commit: customer + Event, or hold.
 * Does not create a standalone unbooked Client as success.
 */
import type { createClient } from "@/integrations/supabase/server";
import { addImportedEventToClient } from "@/lib/booking-journey/add-imported-event";
import {
  classifyImportedClientBooking,
  type ImportedBookingKind,
} from "@/lib/import/client-event-commit";
import { createClientForVenue, createClient_ } from "@/lib/clients/service";
import type { ClientInput } from "@/lib/clients/types";
import { knownOriginalBookingDate } from "@/lib/booking-journey/import-booked-event";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type ImportedClientCommitResult =
  | { ok: true; clientId: string; eventId: string; duplicate: boolean }
  | { ok: false; message: string };

export function classifyClientImportRow(input: {
  eventDate: string;
  bookingStatus?: string | null;
  spaceId?: string | null;
  requiresSpace: boolean;
  spaceResolutionError?: string | null;
}) {
  return classifyImportedClientBooking(input);
}

export async function commitImportedClientAndEvent(opts: {
  supabase: DbClient;
  venueId: string;
  input: ClientInput;
  classification: { kind: ImportedBookingKind; eventDate: string };
  existingClientId: string | null;
  isAdmin: boolean;
  allowAdditionalEvent?: boolean;
}): Promise<ImportedClientCommitResult> {
  const input: ClientInput = { ...opts.input, eventDate: opts.classification.eventDate, skipIdentityReview: true };

  if (opts.existingClientId) {
    const added = await addImportedEventToClient(opts.supabase, {
      venueId: opts.venueId,
      clientId: opts.existingClientId,
      input,
      kind: opts.classification.kind,
      eventDate: opts.classification.eventDate,
      allowAdditional: opts.allowAdditionalEvent === true,
    });
    if (!added.ok) return added;
    if (!added.duplicate) {
      await stampClientEventSourceData(opts.supabase, opts.existingClientId, added.eventId, input);
    }
    return { ok: true, clientId: opts.existingClientId, eventId: added.eventId, duplicate: added.duplicate };
  }

  const lifecycleBookedAt = knownOriginalBookingDate(input.originalBookedOn);
  const lifecycleOpts = {
    markAsAlreadyBooked: opts.classification.kind === "upcoming",
    lifecycleBookedAt,
  };
  const result = opts.isAdmin
    ? await createClientForVenue(
        opts.venueId,
        input,
        true,
        opts.classification.kind === "historical",
        lifecycleOpts,
      )
    : await createClient_(
        input,
        true,
        opts.classification.kind === "historical",
        lifecycleOpts,
      );

  if (!result.ok) {
    return { ok: false, message: result.message ?? "Could not import this client and event." };
  }
  if (!result.eventId) {
    return { ok: false, message: "Client import did not establish an Event. The booking was not imported." };
  }
  await stampClientEventSourceData(opts.supabase, result.clientId, result.eventId, input);
  return { ok: true, clientId: result.clientId, eventId: result.eventId, duplicate: false };
}

async function stampClientEventSourceData(
  supabase: DbClient,
  clientId: string,
  eventId: string,
  input: ClientInput,
): Promise<void> {
  const { clientEventSourceData } = await import("@/lib/import/client-event-match");
  const data = clientEventSourceData({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    partnerFirstName: input.partnerFirstName,
    partnerLastName: input.partnerLastName,
    eventDate: input.eventDate,
    eventType: input.eventType,
    guestCount: input.guestCount,
    internalNotes: input.internalNotes,
    ceremonyTime: input.ceremonyTime,
    receptionTime: input.receptionTime,
    spaceId: input.spaceId,
    bookingStatus: input.bookingStatus,
    sourceClientId: input.sourceClientId,
    sourceEventId: input.sourceEventId,
  });
  const clientStamp = await supabase.from("clients").update({ source_data: data.client }).eq("id", clientId);
  const eventStamp = await supabase.from("events").update({ source_data: data.event }).eq("id", eventId);
  if (clientStamp.error) console.error("Client import source_data stamp failed:", clientStamp.error.message);
  if (eventStamp.error) console.error("Event import source_data stamp failed:", eventStamp.error.message);
}
