/**
 * Narrow B / B2–B3 — recalc headcount-bound Event Order lines when
 * Guaranteed ?? Estimated changes.
 *
 * B2: open + unshared + unapproved → silent live update.
 * B3: shared + unapproved → reopen if finalized, update live lines so the
 *     existing share-stale / "Send updated copy" path lights up. Couple still
 *     sees the last share snapshot until the venue re-shares.
 * Approved (clientAgreedAt) and EO-linked invoices stay frozen.
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
  reopened?: boolean;
  skippedReason?:
    | "flag_off"
    | "no_bound_count"
    | "no_event_order"
    | "not_open"
    | "approved"
    | "eo_invoice_present";
};

/**
 * Null = allowed to recalc (possibly after reopen).
 * Approved never auto-recalcs. Finalized-without-share stays blocked.
 */
export function shouldRecalcBoundLines(order: {
  status: string;
  sharedAt: string | null;
  clientAgreedAt: string | null;
}): HeadcountRecalcResult["skippedReason"] | null {
  if (order.clientAgreedAt) return "approved";
  if (order.status === "open") return null;
  // B3: finalized + shared + unapproved → reopen then recalc.
  if (order.status === "finalized" && order.sharedAt) return null;
  return "not_open";
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

  let order = await eoRepo.getEventOrderByEvent(supabase, venueId, eventId);
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

  let reopened = false;
  const wasShared = Boolean(order.sharedAt);
  if (order.status === "finalized" && order.sharedAt && !order.clientAgreedAt) {
    await eoRepo.reopenEventOrder(supabase, venueId, order.id);
    reopened = true;
    await eoRepo.insertActivity(
      supabase,
      venueId,
      order.id,
      "reopened",
      "Reopened so headcount-bound lines can update",
      "Guaranteed or Estimated changed while the couple still has an unapproved shared copy. Send the updated copy when ready.",
    );
    order = await eoRepo.getEventOrderByEvent(supabase, venueId, eventId);
    if (!order || order.status !== "open") {
      return { attempted: false, updated: 0, skippedReason: "not_open", reopened };
    }
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
      wasShared
        ? "Live lines now differ from the couple's shared copy — use Send updated copy."
        : "Guaranteed or Estimated changed while the Event Order was still open and unshared.",
    );
  }

  return { attempted: true, updated, reopened };
}
