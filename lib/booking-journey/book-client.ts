/**
 * The venue's Booked transition.
 *
 * One database transaction (book_relationship):
 * lock the client, let the event trigger take the venue/date advisory
 * lock and validate availability, create or restore the Booked Event,
 * move the relationship to Booked, stamp booked timestamps, and attach
 * pre-booking planning. Any failure rolls all of that back.
 *
 * Canonical callers: confirmPipelineBookedMove, returnLeadToBooked,
 * returnClientToBooked, an import the venue marked already booked, and
 * Create Event when a client is chosen. Commercial milestones do not
 * call this. A second call does not create another event.
 *
 * Sequence exit, the lifecycle booking row, and the tour-converted
 * signal run only after the transaction commits. They are not the
 * booking. A failure there does not undo Booked and cannot leave an
 * event without the relationship.
 */
import type { createClient } from "@/integrations/supabase/server";
import { calendarBlockFailureFromUnknown, occupancyFailureFromUnknown } from "@/lib/availability/event-occupancy";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type BookClientInput = {
  venueId: string;
  clientId: string;
  eventId?: string | null;
  leadId?: string | null;
  pipelineStageId?: string | null;
  /** Why this call happened. Only a venue decision may book. */
  source: "manual";
  spaceId?: string | null;
  /** Create Event / import may supply the occasion. Omitted fields use the client's preference. */
  event?: {
    name?: string;
    eventType?: string;
    eventDate?: string;
    eventEndDate?: string;
    startTime?: string;
    endTime?: string;
    setupTime?: string;
    teardownTime?: string;
    guestCount?: string;
  };
  lifecycleOrigin?: "pipeline" | "direct" | "import";
};

export type BookClientResult =
  | {
      ok: true;
      booked: true;
      /** True only when events.booked_at was set by this transaction. */
      newlyBooked: boolean;
      eventId: string;
      clientId: string;
    }
  | { ok: false; message: string };

type BookRelationshipRow = {
  ok: boolean;
  message?: string;
  newly_booked?: boolean;
  event_id?: string;
  client_id?: string;
  lead_id?: string | null;
  previous_sales_stage?: string | null;
};

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export async function bookClient(
  supabase: DbClient,
  input: BookClientInput,
): Promise<BookClientResult> {
  const { venueId, clientId } = input;
  if (!clientId) return { ok: false, message: "A client is required to book." };

  const guest = emptyToNull(input.event?.guestCount);
  const parsedGuest = guest ? Number.parseInt(guest, 10) : Number.NaN;
  const { data, error } = await supabase.rpc("book_relationship", {
    p_venue_id: venueId,
    p_client_id: clientId,
    p_space_id: emptyToNull(input.spaceId),
    p_pipeline_stage_id: emptyToNull(input.pipelineStageId),
    p_name: emptyToNull(input.event?.name),
    p_event_type: emptyToNull(input.event?.eventType),
    p_event_date: emptyToNull(input.event?.eventDate),
    p_event_end_date: emptyToNull(input.event?.eventEndDate),
    p_start_time: emptyToNull(input.event?.startTime),
    p_end_time: emptyToNull(input.event?.endTime),
    p_setup_time: emptyToNull(input.event?.setupTime),
    p_teardown_time: emptyToNull(input.event?.teardownTime),
    p_guest_count: Number.isFinite(parsedGuest) ? parsedGuest : null,
    p_lifecycle_origin: input.lifecycleOrigin ?? null,
  });
  if (error) {
    const fail = occupancyFailureFromUnknown(error) ?? calendarBlockFailureFromUnknown(error);
    return { ok: false, message: fail?.message ?? error.message ?? "This date is not available." };
  }

  const row = data as BookRelationshipRow | null;
  if (!row?.ok || !row.event_id) {
    return { ok: false, message: row?.message ?? "This relationship could not be booked." };
  }

  const newlyBooked = row.newly_booked === true;
  const stageChanged = !!row.lead_id && row.previous_sales_stage !== "booked";

  if (stageChanged || (!row.lead_id && newlyBooked)) {
    try {
      const { recordLifecycleBooking } = await import("@/lib/lifecycle-bookings/service");
      const { data: { user } } = await supabase.auth.getUser();
      await recordLifecycleBooking(supabase, {
        venueId,
        leadId: row.lead_id,
        clientId,
        origin: input.lifecycleOrigin ?? (row.lead_id ? "pipeline" : "direct"),
        actorUserId: user?.id ?? null,
        previousSalesStage: row.previous_sales_stage ?? null,
        metadata: { source: input.source },
      });
    } catch (err) {
      console.error("Lifecycle booking record failed:", err);
    }
  }

  if (row.lead_id && stageChanged) {
    const { data: tour } = await supabase
      .from("tour_appointments")
      .select("id")
      .eq("lead_id", row.lead_id)
      .eq("venue_id", venueId)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (tour) {
      void supabase.from("lead_signal_events").insert({
        venue_id: venueId,
        lead_id: row.lead_id,
        signal_type: "tour_converted",
        signal_strength: 3,
        metadata: { appointment_id: tour.id },
      }).then(null, () => {});
    }
  }

  if (newlyBooked || stageChanged) {
    const { data: rel } = await supabase
      .from("clients")
      .select("relationship_id")
      .eq("id", clientId)
      .eq("venue_id", venueId)
      .maybeSingle<{ relationship_id: string | null }>();
    if (rel?.relationship_id) {
      const { exitEnrollmentsForBooking } = await import("@/lib/message-sequences/service");
      void exitEnrollmentsForBooking(supabase, venueId, rel.relationship_id).catch((e) =>
        console.error("Series exit-on-booking failed:", e),
      );
    }
  }

  return { ok: true, booked: true, newlyBooked, eventId: row.event_id, clientId };
}
