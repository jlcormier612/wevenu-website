/**
 * Stamp events.booked_at only when the commercial Booked milestone is met:
 * agreement complete (offer accepted or contract signed) + required deposit paid.
 *
 * Does not stamp for Start booking file, Direct Add, or mere Client/Event create.
 * ensureEventBookedAt is write-once — safe to call repeatedly.
 *
 * Works with session or service_role clients (no getCurrentVenue dependency).
 */

import type { createClient } from "@/integrations/supabase/server";
import { isCommerciallyBooked } from "@/lib/booking-journey/model";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { ensureEventBookedAt } from "@/lib/events/repository";
import type { PaymentItemStatus, PaymentObligationKind } from "@/lib/payments/types";
import { getVenueTimezone, venueToday } from "@/lib/venue/timezone";

type DbClient = Awaited<ReturnType<typeof createClient>>;

function mapSelectionStatus(raw: string): CommercialSelection["status"] {
  if (raw === "offered" || raw === "accepted" || raw === "superseded" || raw === "draft") return raw;
  return "draft";
}

export async function maybeStampCommercialBookedAt(
  supabase: DbClient,
  venueId: string,
  opts: { clientId: string; eventId?: string | null },
): Promise<void> {
  const clientId = opts.clientId;
  if (!clientId) return;

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
  if (!eventId) return;

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

  const commerciallyBooked = isCommerciallyBooked({
    selection: selection as CommercialSelection | null,
    contract,
    paymentLines,
  });
  if (!commerciallyBooked) return;

  const tz = await getVenueTimezone(supabase, venueId);
  await ensureEventBookedAt(supabase, venueId, eventId, venueToday(tz));
}
