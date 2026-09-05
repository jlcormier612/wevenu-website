/**
 * Lifecycle Booking — durable venue booking history.
 *
 * Distinct from:
 * - Financially Committed (`canonical_bookings`)
 * - Payment timing (`events.booked_at`)
 *
 * Origins: pipeline | direct | import
 * Kinds: first_booked (Reporting booking date) | rebooked (does not overwrite first)
 */
import type { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type LifecycleBookingOrigin = "pipeline" | "direct" | "import";
export type LifecycleBookingEventKind = "first_booked" | "rebooked";

export type RecordLifecycleBookingInput = {
  venueId: string;
  leadId?: string | null;
  clientId?: string | null;
  origin: LifecycleBookingOrigin;
  /** ISO timestamptz or date; defaults to now. Never invent from finance. */
  occurredAt?: string | null;
  actorUserId?: string | null;
  previousSalesStage?: string | null;
  metadata?: Record<string, unknown>;
};

export type LifecycleBookingEvent = {
  id: string;
  venueId: string;
  leadId: string | null;
  clientId: string | null;
  origin: LifecycleBookingOrigin;
  eventKind: LifecycleBookingEventKind;
  occurredAt: string;
  actorUserId: string | null;
  previousSalesStage: string | null;
};

export type RecordLifecycleBookingResult =
  | { ok: true; event: LifecycleBookingEvent; wasFirst: boolean }
  | { ok: false; message: string };

function normalizeOccurredAt(raw: string | null | undefined): string {
  if (!raw?.trim()) return new Date().toISOString();
  const trimmed = raw.trim();
  // Date-only → noon UTC to avoid off-by-one in venue-local display.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00.000Z`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

async function findExistingFirst(
  client: DbClient,
  venueId: string,
  leadId: string | null | undefined,
  clientId: string | null | undefined,
): Promise<{ id: string; occurred_at: string } | null> {
  if (leadId) {
    const { data } = await client
      .from("lifecycle_booking_events")
      .select("id, occurred_at")
      .eq("venue_id", venueId)
      .eq("lead_id", leadId)
      .eq("event_kind", "first_booked")
      .maybeSingle<{ id: string; occurred_at: string }>();
    return data ?? null;
  }
  if (clientId) {
    const { data } = await client
      .from("lifecycle_booking_events")
      .select("id, occurred_at")
      .eq("venue_id", venueId)
      .eq("client_id", clientId)
      .is("lead_id", null)
      .eq("event_kind", "first_booked")
      .maybeSingle<{ id: string; occurred_at: string }>();
    return data ?? null;
  }
  return null;
}

/**
 * Record a lifecycle booking. First transition → first_booked (stamps denormalized
 * dates). Later pipeline return to Booked → rebooked (preserves first date).
 */
export async function recordLifecycleBooking(
  client: DbClient,
  input: RecordLifecycleBookingInput,
): Promise<RecordLifecycleBookingResult> {
  const leadId = input.leadId ?? null;
  const clientId = input.clientId ?? null;
  if (!leadId && !clientId) {
    return { ok: false, message: "Lifecycle booking requires a lead or client." };
  }

  const occurredAt = normalizeOccurredAt(input.occurredAt);
  const existing = await findExistingFirst(client, input.venueId, leadId, clientId);

  // Direct / import retries: idempotent — never invent rebooked for those origins.
  // Pipeline rebooked only when returning to Booked after leaving it.
  if (existing && input.origin !== "pipeline") {
    return {
      ok: true,
      wasFirst: false,
      event: {
        id: existing.id,
        venueId: input.venueId,
        leadId,
        clientId,
        origin: input.origin,
        eventKind: "first_booked",
        occurredAt: existing.occurred_at,
        actorUserId: input.actorUserId ?? null,
        previousSalesStage: input.previousSalesStage ?? null,
      },
    };
  }

  const eventKind: LifecycleBookingEventKind = existing ? "rebooked" : "first_booked";

  // Frozen acquisition at first_booked only — from lead.acquisition_source (never invent).
  let acquisitionSource: string | null = null;
  if (eventKind === "first_booked" && leadId) {
    const { data: leadRow } = await client
      .from("leads")
      .select("acquisition_source")
      .eq("id", leadId)
      .eq("venue_id", input.venueId)
      .maybeSingle<{ acquisition_source: string | null }>();
    acquisitionSource = leadRow?.acquisition_source ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("lifecycle_booking_events") as any)
    .insert({
      venue_id: input.venueId,
      lead_id: leadId,
      client_id: clientId,
      origin: input.origin,
      event_kind: eventKind,
      occurred_at: occurredAt,
      actor_user_id: input.actorUserId ?? null,
      previous_sales_stage: input.previousSalesStage ?? null,
      metadata: input.metadata ?? {},
      acquisition_source: eventKind === "first_booked" ? acquisitionSource : null,
    })
    .select("id, venue_id, lead_id, client_id, origin, event_kind, occurred_at, actor_user_id, previous_sales_stage, acquisition_source")
    .single();

  if (error || !data) {
    // Unique race: treat as rebooked retry for pipeline, or no-op success for first.
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "23505") {
      const again = await findExistingFirst(client, input.venueId, leadId, clientId);
      if (again) {
        return {
          ok: true,
          wasFirst: false,
          event: {
            id: again.id,
            venueId: input.venueId,
            leadId,
            clientId,
            origin: input.origin,
            eventKind: "first_booked",
            occurredAt: again.occurred_at,
            actorUserId: input.actorUserId ?? null,
            previousSalesStage: input.previousSalesStage ?? null,
          },
        };
      }
    }
    return { ok: false, message: error?.message ?? "Could not record lifecycle booking." };
  }

  const row = data as {
    id: string; venue_id: string; lead_id: string | null; client_id: string | null;
    origin: LifecycleBookingOrigin; event_kind: LifecycleBookingEventKind;
    occurred_at: string; actor_user_id: string | null; previous_sales_stage: string | null;
  };

  if (eventKind === "first_booked") {
    if (leadId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from("leads") as any)
        .update({ first_booked_at: occurredAt })
        .eq("id", leadId)
        .eq("venue_id", input.venueId)
        .is("first_booked_at", null);
    }
    if (clientId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from("clients") as any)
        .update({
          lifecycle_booked_at: occurredAt,
          lifecycle_booking_origin: input.origin,
        })
        .eq("id", clientId)
        .eq("venue_id", input.venueId)
        .is("lifecycle_booked_at", null);
    }
  }

  return {
    ok: true,
    wasFirst: eventKind === "first_booked",
    event: {
      id: row.id,
      venueId: row.venue_id,
      leadId: row.lead_id,
      clientId: row.client_id,
      origin: row.origin,
      eventKind: row.event_kind,
      occurredAt: row.occurred_at,
      actorUserId: row.actor_user_id,
      previousSalesStage: row.previous_sales_stage,
    },
  };
}

export type LifecycleBookingRow = {
  id: string;
  leadId: string | null;
  clientId: string | null;
  origin: LifecycleBookingOrigin;
  occurredAt: string;
  actorUserId: string | null;
  /** Frozen acquisition_source on the first_booked row (null = Unknown). */
  acquisitionSource: string | null;
};

/** First lifecycle bookings in a date window (Reporting Bookings count). */
export async function listLifecycleBookingsInPeriod(
  client: DbClient,
  venueId: string,
  window: { from?: string; to?: string },
): Promise<LifecycleBookingRow[]> {
  let q = client
    .from("lifecycle_booking_events")
    .select("id, lead_id, client_id, origin, occurred_at, actor_user_id, acquisition_source")
    .eq("venue_id", venueId)
    .eq("event_kind", "first_booked")
    .order("occurred_at", { ascending: false });
  if (window.from) q = q.gte("occurred_at", `${window.from}T00:00:00.000Z`);
  if (window.to) q = q.lte("occurred_at", `${window.to}T23:59:59.999Z`);
  const { data } = await q;
  return ((data ?? []) as {
    id: string; lead_id: string | null; client_id: string | null;
    origin: LifecycleBookingOrigin; occurred_at: string; actor_user_id: string | null;
    acquisition_source: string | null;
  }[]).map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    clientId: r.client_id,
    origin: r.origin,
    occurredAt: r.occurred_at,
    actorUserId: r.actor_user_id,
    acquisitionSource: r.acquisition_source ?? null,
  }));
}

export function originLabel(origin: LifecycleBookingOrigin): string {
  switch (origin) {
    case "pipeline": return "Pipeline";
    case "direct": return "Direct";
    case "import": return "Imported";
  }
}
