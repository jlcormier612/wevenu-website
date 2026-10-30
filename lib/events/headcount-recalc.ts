/**
 * Narrow B / B2 — recalc open, unshared, unapproved Event Order lines
 * marked bound_to_headcount when Guaranteed ?? Estimated changes.
 *
 * Does not touch invoices. Blocks when any non-void EO-linked invoice exists
 * (careful front-load of the B4 draft boundary).
 */
import type { createClient } from "@/integrations/supabase/server";
import * as eoRepo from "@/lib/event-orders/repository";
import {
  boundHeadcountForApply,
  headcountRecalcEnabled,
} from "@/lib/events/headcount";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type HeadcountRecalcResult = {
  attempted: boolean;
  updated: number;
  skippedReason?:
    | "flag_off"
    | "no_bound_count"
    | "no_event_order"
    | "not_open"
    | "shared"
    | "approved"
    | "eo_invoice_present";
};

export function shouldRecalcBoundLines(order: {
  status: string;
  sharedAt: string | null;
  clientAgreedAt: string | null;
}): HeadcountRecalcResult["skippedReason"] | null {
  if (order.status !== "open") return "not_open";
  if (order.sharedAt) return "shared";
  if (order.clientAgreedAt) return "approved";
  return null;
}

export async function recalculateBoundEventOrderLinesForEvent(
  supabase: DbClient,
  venueId: string,
  eventId: string,
  nextEstimated: number | null,
  nextGuaranteed: number | null,
): Promise<HeadcountRecalcResult> {
  if (!headcountRecalcEnabled()) {
    return { attempted: false, updated: 0, skippedReason: "flag_off" };
  }

  const bound = boundHeadcountForApply(nextEstimated, nextGuaranteed);
  if (bound == null || bound <= 0) {
    return { attempted: false, updated: 0, skippedReason: "no_bound_count" };
  }

  const order = await eoRepo.getEventOrderByEvent(supabase, venueId, eventId);
  if (!order) {
    return { attempted: false, updated: 0, skippedReason: "no_event_order" };
  }

  const gate = shouldRecalcBoundLines(order);
  if (gate) {
    return { attempted: false, updated: 0, skippedReason: gate };
  }

  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("venue_id", venueId)
    .eq("event_order_id", order.id)
    .neq("status", "void");
  if (invErr) throw invErr;
  if ((invoices ?? []).length > 0) {
    return { attempted: false, updated: 0, skippedReason: "eo_invoice_present" };
  }

  let updated = 0;
  for (const line of order.lines) {
    if (!line.boundToHeadcount) continue;
    if (line.quantity === bound) continue;
    await eoRepo.updateLineQuantityKeepingBound(
      supabase,
      venueId,
      line.id,
      bound,
      line.unitPrice,
    );
    updated += 1;
  }

  if (updated > 0) {
    await eoRepo.insertActivity(
      supabase,
      venueId,
      order.id,
      "headcount_recalc",
      `Updated ${updated} headcount-bound line${updated === 1 ? "" : "s"} to ${bound} guests`,
      "Guaranteed or Estimated changed while the Event Order was still open and unshared.",
    );
  }

  return { attempted: true, updated };
}
