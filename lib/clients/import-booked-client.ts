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
}): Promise<ImportedClientCommitResult> {
  const input: ClientInput = { ...opts.input, eventDate: opts.classification.eventDate, skipIdentityReview: true };

  if (opts.existingClientId) {
    const added = await addImportedEventToClient(opts.supabase, {
      venueId: opts.venueId,
      clientId: opts.existingClientId,
      input,
      kind: opts.classification.kind,
      eventDate: opts.classification.eventDate,
    });
    if (!added.ok) return added;
    return { ok: true, clientId: opts.existingClientId, eventId: added.eventId, duplicate: added.duplicate };
  }

  const result = opts.isAdmin
    ? await createClientForVenue(
        opts.venueId,
        input,
        true,
        opts.classification.kind === "historical",
        opts.classification.kind === "upcoming" ? { markAsAlreadyBooked: true } : undefined,
      )
    : await createClient_(
        input,
        true,
        opts.classification.kind === "historical",
        opts.classification.kind === "upcoming" ? { markAsAlreadyBooked: true } : undefined,
      );

  if (!result.ok) {
    return { ok: false, message: result.message ?? "Could not import this client and event." };
  }
  if (!result.eventId) {
    return { ok: false, message: "Client import did not establish an Event. The booking was not imported." };
  }
  return { ok: true, clientId: result.clientId, eventId: result.eventId, duplicate: false };
}
