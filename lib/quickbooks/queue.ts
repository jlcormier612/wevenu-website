/**
 * QuickBooks sync queue — enqueue side. Mirrors the existing fire-and-
 * forget pattern already used for `void recordEngagementEvent(...)`
 * elsewhere in this codebase: never throws, safe to call unconditionally
 * from any existing service-layer function.
 */
import { createHash } from "node:crypto";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isQuickBooksConfigured } from "@/lib/quickbooks/config";
import * as repo from "@/lib/quickbooks/repository";
import type { QuickBooksEntityType } from "@/lib/quickbooks/types";

function hashPayload(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(stable).digest("hex");
}

/**
 * Enqueues a Customer/Invoice/Payment/Refund push. Always safe to call —
 * short-circuits to a no-op if QuickBooks isn't configured at all, and
 * internally catches/logs rather than throwing, so it never blocks the
 * caller's own transaction. Also sets the record's own
 * quickbooks_sync_status to 'pending' so a coordinator sees the sync is
 * queued even before the processor's next tick.
 */
export async function enqueueQuickBooksSync(
  venueId: string,
  entityType: QuickBooksEntityType,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isQuickBooksConfigured()) return;
  try {
    const admin = createAdminClient();
    const payloadHash = hashPayload(payload);
    await repo.enqueueSync(admin, { venueId, entityType, entityId, payloadHash });
    await setPendingStatus(admin, entityType, entityId);
  } catch (err) {
    console.error(`[quickbooks] enqueue failed for ${entityType}:${entityId}`, err);
  }
}

/**
 * Every enqueue — first sync or a re-sync after a legitimate edit — sets
 * the record to 'pending'. 'pending' communicates "in flight," whether
 * this is the very first sync or a re-sync of something previously
 * 'synced'/'failed'; there's no need to distinguish those cases here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setPendingStatus(admin: any, entityType: QuickBooksEntityType, entityId: string): Promise<void> {
  const table = entityType === "customer" ? "clients" : entityType === "invoice" ? "invoices" : "payment_line_items";
  await admin.from(table).update({ quickbooks_sync_status: "pending" }).eq("id", entityId);
}
