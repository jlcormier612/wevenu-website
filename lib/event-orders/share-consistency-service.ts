/**
 * Server helpers: compare live Event Order to last share snapshot.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/event-orders/repository";
import {
  invoiceBlockedWhenSharedCommitmentStale,
  shareCommitmentContentDiffers,
  type ShareLineFingerprintInput,
} from "@/lib/event-orders/share-consistency";
import { getEventOrder } from "@/lib/event-orders/service";
import { getCurrentVenue } from "@/lib/venue/service";

function linesFromLive(order: NonNullable<Awaited<ReturnType<typeof getEventOrder>>>): ShareLineFingerprintInput[] {
  return order.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    amount: l.amount,
    isIncluded: l.isIncluded,
  }));
}

function linesFromSnapshotPayload(payload: {
  lines?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number | null;
    amount?: number;
    isIncluded?: boolean;
  }>;
}): ShareLineFingerprintInput[] {
  return (payload.lines ?? []).map((l) => ({
    description: String(l.description ?? ""),
    quantity: Number(l.quantity) || 0,
    unitPrice: l.unitPrice ?? null,
    amount: Number(l.amount) || 0,
    isIncluded: Boolean(l.isIncluded),
  }));
}

export async function evaluateEventOrderShareStale(eventOrderId: string): Promise<{
  hasBeenShared: boolean;
  liveDiffersFromLastShare: boolean;
}> {
  if (!isSupabaseConfigured) {
    return { hasBeenShared: false, liveDiffersFromLastShare: false };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { hasBeenShared: false, liveDiffersFromLastShare: false };
  const supabase = await createClient();
  const order = await repo.getEventOrderById(supabase, venue.id, eventOrderId);
  if (!order?.sharedAt) {
    return { hasBeenShared: false, liveDiffersFromLastShare: false };
  }
  const snap = await repo.getLatestShareSnapshot(supabase, venue.id, eventOrderId);
  if (!snap) {
    // shared_at set but snapshot missing — treat as stale to force intentional re-share.
    return { hasBeenShared: true, liveDiffersFromLastShare: true };
  }
  const full = await getEventOrder(order.eventId);
  if (!full) {
    return { hasBeenShared: true, liveDiffersFromLastShare: true };
  }
  return {
    hasBeenShared: true,
    liveDiffersFromLastShare: shareCommitmentContentDiffers(
      linesFromLive(full),
      linesFromSnapshotPayload(snap.payload),
    ),
  };
}

/** Block original (non-amend) EO invoice create/send when couple still sees a divergent share. */
export async function gateOriginalEoInvoiceWhenShareStale(
  eventOrderId: string,
  opts?: { isAmendingInvoice?: boolean },
): Promise<{ ok: false; message: string } | null> {
  if (opts?.isAmendingInvoice) return null;
  const evaled = await evaluateEventOrderShareStale(eventOrderId);
  return invoiceBlockedWhenSharedCommitmentStale({
    hasBeenShared: evaled.hasBeenShared,
    isAmendingInvoice: Boolean(opts?.isAmendingInvoice),
    liveDiffersFromLastShare: evaled.liveDiffersFromLastShare,
  });
}
