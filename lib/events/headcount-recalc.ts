/**
 * Narrow B / B2–B4 — recalc headcount-bound Event Order lines when
 * Guaranteed ?? Estimated changes.
 *
 * B2: open + unshared + unapproved → silent live update.
 * B3: shared + unapproved → reopen if finalized, update live lines so the
 *     existing share-stale / "Send updated copy" path lights up. Couple still
 *     sees the last share snapshot until the venue re-shares.
 * B4: any non-void EO-linked invoice blocks recalc (draft and issued).
 *     Invoice rows are never updated from a headcount edit.
 * Approved (clientAgreedAt) stays frozen.
 */
import type { createClient } from "@/integrations/supabase/server";
import * as eoRepo from "@/lib/event-orders/repository";
import {
  boundHeadcountForApply,
  headcountRecalcEnabled,
} from "@/lib/events/headcount";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type HeadcountRecalcSkipReason =
  | "flag_off"
  | "no_bound_count"
  | "no_event_order"
  | "not_open"
  | "approved"
  | "eo_invoice_draft"
  | "eo_invoice_issued";

export type HeadcountRecalcResult = {
  attempted: boolean;
  updated: number;
  reopened?: boolean;
  skippedReason?: HeadcountRecalcSkipReason;
};

/**
 * Null = allowed to recalc (possibly after reopen).
 * Approved never auto-recalcs. Finalized-without-share stays blocked.
 */
export function shouldRecalcBoundLines(order: {
  status: string;
  sharedAt: string | null;
  clientAgreedAt: string | null;
}): HeadcountRecalcSkipReason | null {
  if (order.clientAgreedAt) return "approved";
  if (order.status === "open") return null;
  // B3: finalized + shared + unapproved → reopen then recalc.
  if (order.status === "finalized" && order.sharedAt) return null;
  return "not_open";
}

/**
 * B4 — any non-void EO-linked invoice blocks auto-recalc.
 * Draft is called out separately so the venue knows the careful v1 rule.
 */
export function classifyBlockingEoInvoice(
  invoices: Array<{ status: string }>,
): "eo_invoice_draft" | "eo_invoice_issued" | null {
  const live = invoices.filter((inv) => inv.status !== "void");
  if (live.length === 0) return null;
  if (live.some((inv) => inv.status === "draft")) return "eo_invoice_draft";
  return "eo_invoice_issued";
}

/** Venue-facing Save notice when auto-recalc did not apply. Null = stay quiet. */
export function venueNoticeForHeadcountSkip(
  reason: HeadcountRecalcSkipReason | undefined,
): string | null {
  switch (reason) {
    case "flag_off":
      return "Guest count saved. Automatic Event Order quantity updates are turned off.";
    case "approved":
      return "Guest count saved. Approved Event Order quantities stay frozen until you send an updated copy.";
    case "eo_invoice_draft":
      return "Guest count saved. Event Order quantities were left unchanged because a draft Event Order invoice exists. Void or finish that invoice first.";
    case "eo_invoice_issued":
      return "Guest count saved. Event Order quantities and invoice amounts stay frozen — headcount edits never reprice an issued invoice.";
    default:
      return null;
  }
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
  const invoiceBlock = classifyBlockingEoInvoice(invoices ?? []);
  if (invoiceBlock) {
    await eoRepo.insertActivity(
      supabase,
      venueId,
      order.id,
      "headcount_recalc_blocked",
      "Headcount changed — Event Order quantities left unchanged",
      invoiceBlock === "eo_invoice_draft"
        ? "A draft Event Order invoice exists, so bound lines were not refreshed. Void or finish that invoice before relying on automatic headcount updates."
        : "An Event Order invoice was already issued, so bound lines and invoice amounts stay frozen. Headcount edits never reprice a sent or paid invoice.",
    );
    return { attempted: false, updated: 0, skippedReason: invoiceBlock };
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
