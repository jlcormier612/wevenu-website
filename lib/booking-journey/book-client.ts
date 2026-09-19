/**
 * The one Lead → Booked Client transition.
 *
 * Automatic booking calls this after `isCommerciallyBooked` is true.
 * Manual "Mark as Booked" calls this after the venue confirms.
 * Both produce the same persisted state. A second call is a no-op.
 */
import type { createClient } from "@/integrations/supabase/server";
import { ensureEventBookedAt } from "@/lib/events/repository";
import { getVenueTimezone, venueToday } from "@/lib/venue/timezone";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type BookClientInput = {
  venueId: string;
  clientId: string;
  eventId?: string | null;
  leadId?: string | null;
  pipelineStageId?: string | null;
  /** Why this call happened. Does not change the resulting booked state. */
  source: "commercial_rule" | "manual";
};

export type BookClientResult =
  | {
      ok: true;
      booked: true;
      /** True only when events.booked_at changed from null to a timestamp. */
      newlyBooked: boolean;
      eventId: string;
      clientId: string;
    }
  | { ok: false; message: string };

export async function bookClient(
  supabase: DbClient,
  input: BookClientInput,
): Promise<BookClientResult> {
  const { venueId, clientId } = input;
  if (!clientId) return { ok: false, message: "A client is required to book." };

  let eventId = input.eventId ?? null;
  if (!eventId) {
    const { data: ev } = await supabase
      .from("events")
      .select("id")
      .eq("venue_id", venueId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    eventId = ev?.id ?? null;
  }
  if (!eventId) return { ok: false, message: "This relationship has no event to book." };

  const { data: before } = await supabase
    .from("events")
    .select("booked_at, status")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{ booked_at: string | null; status: string }>();
  if (!before) return { ok: false, message: "Event not found." };

  // Automatic booking must not undo an explicit cancellation.
  // Manual Mark as Booked / Return to Booked is the reactivation path.
  if (before.status === "cancelled" && input.source !== "manual") {
    return { ok: true, booked: true, newlyBooked: false, eventId, clientId };
  }

  const newlyBooked = before.booked_at == null;
  const tz = await getVenueTimezone(supabase, venueId);
  await ensureEventBookedAt(supabase, venueId, eventId, venueToday(tz));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("events") as any)
    .update({
      status: "confirmed",
      ...(newlyBooked ? { booking_celebration_pending: true } : {}),
    })
    .eq("id", eventId)
    .eq("venue_id", venueId);

  await supabase
    .from("clients")
    .update({ status: "confirmed" })
    .eq("id", clientId)
    .eq("venue_id", venueId);

  let leadId = input.leadId ?? null;
  if (!leadId) {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("lead_id")
      .eq("id", clientId)
      .eq("venue_id", venueId)
      .maybeSingle<{ lead_id: string | null }>();
    leadId = clientRow?.lead_id ?? null;
  }

  if (leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("sales_stage")
      .eq("id", leadId)
      .eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    if (lead && lead.sales_stage !== "booked") {
      const { updateLeadSalesStage } = await import("@/lib/leads/service");
      const stage = await updateLeadSalesStage(leadId, "booked", {
        allowBooked: true,
        clientId,
        pipelineStageId: input.pipelineStageId ?? undefined,
      });
      if (!stage.ok) return { ok: false, message: stage.message ?? "Could not mark the lead booked." };
    }
  } else if (newlyBooked) {
    const { recordLifecycleBooking } = await import("@/lib/lifecycle-bookings/service");
    const { data: { user } } = await supabase.auth.getUser();
    await recordLifecycleBooking(supabase, {
      venueId,
      clientId,
      origin: "direct",
      actorUserId: user?.id ?? null,
      metadata: { source: input.source },
    });
  }

  return { ok: true, booked: true, newlyBooked, eventId, clientId };
}
