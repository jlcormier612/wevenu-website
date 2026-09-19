/**
 * Stamp events.booked_at only when the commercial Booked milestone is met:
 * agreement complete (offer accepted or contract signed) + required deposit paid.
 *
 * Does not stamp for Start booking file, Direct Add, or mere Client/Event create.
 * bookClient is write-once on events.booked_at — safe to call repeatedly.
 *
 * Works with session or service_role clients (no getCurrentVenue dependency).
 */

import type { createClient } from "@/integrations/supabase/server";
import { isCommerciallyBooked } from "@/lib/booking-journey/model";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import type { PaymentItemStatus, PaymentObligationKind } from "@/lib/payments/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

function mapSelectionStatus(raw: string): CommercialSelection["status"] {
  if (raw === "offered" || raw === "accepted" || raw === "superseded" || raw === "draft") return raw;
  return "draft";
}

export type CommercialStampResult = {
  /** True only when this call stamped events.booked_at for the first time. */
  newlyBooked: boolean;
  clientId: string;
  eventId: string;
};

export async function maybeStampCommercialBookedAt(
  supabase: DbClient,
  venueId: string,
  opts: { clientId: string; eventId?: string | null },
): Promise<CommercialStampResult | null> {
  const clientId = opts.clientId;
  if (!clientId) return null;

  let eventId = opts.eventId ?? null;
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
  if (!eventId) return null;

  const { data: selRow } = await supabase
    .from("commercial_selections")
    .select("id, status, name, total_amount, deposit_amount")
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      status: string;
      name: string;
      total_amount: number;
      deposit_amount: number;
    }>();

  const selection = selRow
    ? ({
        id: selRow.id,
        status: mapSelectionStatus(selRow.status),
        name: selRow.name,
        totalAmount: Number(selRow.total_amount),
        depositAmount: Number(selRow.deposit_amount),
      } as Pick<CommercialSelection, "id" | "status" | "name" | "totalAmount" | "depositAmount">)
    : null;

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, status")
    .eq("venue_id", venueId)
    .eq("client_id", clientId);
  const contractRows = (contracts ?? []) as { id: string; status: string }[];
  const pick =
    contractRows.find((c) => c.status === "signed")
    ?? contractRows.find((c) => c.status === "sent")
    ?? contractRows.find((c) => c.status === "draft")
    ?? null;
  const contract = pick
    && (pick.status === "signed" || pick.status === "sent" || pick.status === "draft")
    ? { id: pick.id, status: pick.status as "signed" | "sent" | "draft" }
    : null;

  const { data: schedules } = await supabase
    .from("payment_schedules")
    .select("id")
    .eq("venue_id", venueId)
    .eq("client_id", clientId);
  const scheduleIds = ((schedules ?? []) as { id: string }[]).map((s) => s.id);
  let paymentLines: {
    obligationKind: PaymentObligationKind | null;
    status: PaymentItemStatus;
    amount: number;
  }[] = [];
  if (scheduleIds.length > 0) {
    const { data: lines } = await supabase
      .from("payment_line_items")
      .select("obligation_kind, status, amount")
      .eq("venue_id", venueId)
      .in("schedule_id", scheduleIds);
    paymentLines = ((lines ?? []) as {
      obligation_kind: string | null;
      status: string;
      amount: number;
    }[]).map((l) => ({
      obligationKind: (l.obligation_kind as PaymentObligationKind | null) ?? null,
      status: l.status as PaymentItemStatus,
      amount: Number(l.amount),
    }));
  }

  const { data: venueRow } = await supabase
    .from("venues")
    .select("commercial_booking_prefs")
    .eq("id", venueId)
    .maybeSingle<{ commercial_booking_prefs: unknown }>();

  const { normalizeCommercialBookingPrefs } = await import("@/lib/booking-journey/venue-prefs");
  const prefs = normalizeCommercialBookingPrefs(venueRow?.commercial_booking_prefs);

  const commerciallyBooked = isCommerciallyBooked({
    selection: selection as CommercialSelection | null,
    contract,
    paymentLines,
    prefs,
  });
  if (!commerciallyBooked) return null;

  const { bookClient } = await import("@/lib/booking-journey/book-client");
  const booked = await bookClient(supabase, {
    venueId,
    clientId,
    eventId,
    source: "commercial_rule",
  });
  if (!booked.ok) return null;

  if (selRow && selRow.status !== "accepted" && contract?.status === "signed") {
    const { markAcceptedVenue } = await import("@/lib/commercial-selections/repository");
    await markAcceptedVenue(supabase, venueId, selRow.id);
  }

  return { newlyBooked: booked.newlyBooked, clientId, eventId: booked.eventId };
}
