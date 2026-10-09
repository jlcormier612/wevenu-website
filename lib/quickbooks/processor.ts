/**
 * QuickBooks sync queue processor. Mirrors lib/scheduled-messages/
 * processor.ts's shape (admin client, batch fetch, per-item dispatch),
 * with the real hardening neither that system nor lib/automation/engine.ts
 * needed because neither ever retries: an atomic claim step (guards a
 * second, overlapping cron invocation from double-processing the same
 * row), a connection-level circuit breaker (a disconnected venue's queue
 * waits, it doesn't burn attempts toward dead-letter for a problem that
 * isn't the sync's fault), a dependency check (an invoice/payment/refund
 * push waits for its parent Customer/Invoice to sync first), and real
 * exponential backoff with a dead-letter ceiling instead of retrying
 * forever or never.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import * as repo from "@/lib/quickbooks/repository";
import { computeNextAttemptAt, MAX_ATTEMPTS } from "@/lib/quickbooks/backoff";
import { QUEUE_LEASE_MS } from "@/lib/quickbooks/queue-recovery";
import { recordHealthCheck } from "@/lib/quickbooks/health";
import { syncCustomer } from "@/lib/quickbooks/sync/customer";
import { syncInvoice } from "@/lib/quickbooks/sync/invoice";
import { syncPayment } from "@/lib/quickbooks/sync/payment";
import { syncRefund } from "@/lib/quickbooks/sync/refund";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";
import type { QuickBooksEntityType } from "@/lib/quickbooks/types";

const BATCH_SIZE = 50;

const SYNC_STATUS_TABLE: Record<QuickBooksEntityType, string> = {
  customer: "clients", invoice: "invoices", payment: "payment_line_items", refund: "payment_line_items",
};

const SYNC_ID_COLUMN: Record<QuickBooksEntityType, string> = {
  customer: "quickbooks_customer_id", invoice: "quickbooks_invoice_id",
  payment: "quickbooks_payment_id", refund: "quickbooks_refund_id",
};

async function dispatch(venueId: string, entityType: QuickBooksEntityType, entityId: string): Promise<QuickBooksSyncResult> {
  switch (entityType) {
    case "customer": return syncCustomer(venueId, entityId);
    case "invoice": return syncInvoice(venueId, entityId);
    case "payment": return syncPayment(venueId, entityId);
    case "refund": return syncRefund(venueId, entityId);
  }
}

/**
 * An invoice push needs its Customer already synced; a payment/refund
 * push needs its Invoice already synced. Treated as a normal retryable
 * failure (the dependency is presumably about to succeed on this or a
 * future tick), never a hard error.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkDependency(admin: any, entityType: QuickBooksEntityType, entityId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (entityType === "customer") return { ok: true };

  if (entityType === "invoice") {
    const { data } = await admin.from("invoices").select("client_id").eq("id", entityId).maybeSingle();
    const clientId = (data as { client_id: string | null } | null)?.client_id;
    if (!clientId) return { ok: false, error: "Invoice has no client to check." };
    const { data: client } = await admin.from("clients").select("quickbooks_customer_id").eq("id", clientId).maybeSingle();
    if (!(client as { quickbooks_customer_id: string | null } | null)?.quickbooks_customer_id) {
      return { ok: false, error: "Waiting on Customer sync." };
    }
    return { ok: true };
  }

  // payment | refund — depend on their invoice's schedule's invoice, via payment_line_items -> payment_schedules -> invoice_id
  const { data: item } = await admin.from("payment_line_items").select("schedule_id").eq("id", entityId).maybeSingle();
  const scheduleId = (item as { schedule_id: string | null } | null)?.schedule_id;
  if (!scheduleId) return { ok: false, error: "Payment has no schedule to check." };
  const { data: schedule } = await admin.from("payment_schedules").select("invoice_id").eq("id", scheduleId).maybeSingle();
  const invoiceId = (schedule as { invoice_id: string | null } | null)?.invoice_id;
  if (!invoiceId) return { ok: true }; // no linked invoice at all — nothing to wait on
  const { data: invoice } = await admin.from("invoices").select("quickbooks_invoice_id").eq("id", invoiceId).maybeSingle();
  if (!(invoice as { quickbooks_invoice_id: string | null } | null)?.quickbooks_invoice_id) {
    return { ok: false, error: "Waiting on Invoice sync." };
  }
  return { ok: true };
}

export type ProcessResult = {
  processed: number; succeeded: number; failedRetrying: number; deadLettered: number; skipped: number;
  /** Abandoned pre-dispatch claims returned to the queue this tick. */
  reclaimed: number;
  /** Stale claims that may have reached Intuit — held, not replayed. */
  needsReview: number;
  /** Writes that timed out this tick with an unconfirmed outcome. */
  uncertainWrites: number;
  /** Due work retained for venues that have not connected QuickBooks yet. */
  deferredNoConnection: number;
  /** Age of the oldest due item that could actually sync. Null when none. */
  oldestEligiblePendingAgeMs: number | null;
};

export async function processQuickBooksSyncQueue(): Promise<ProcessResult> {
  const admin = createAdminClient();
  const result: ProcessResult = {
    processed: 0, succeeded: 0, failedRetrying: 0, deadLettered: 0, skipped: 0,
    reclaimed: 0, needsReview: 0, uncertainWrites: 0,
    deferredNoConnection: 0, oldestEligiblePendingAgeMs: null,
  };

  // Recover first so anything freed is eligible within this same tick.
  const recovery = await repo.reclaimAbandonedClaims(admin, QUEUE_LEASE_MS);
  result.reclaimed = recovery.reclaimed;
  result.needsReview = recovery.needsReview;

  const connectedVenueIds = await repo.getConnectedVenueIds(admin);

  // Reported every tick, including when nothing can run, so a queue holding
  // work is never mistaken for an empty one.
  const snapshot = await repo.getQueueSnapshot(admin, connectedVenueIds);
  result.deferredNoConnection = snapshot.deferredNoConnection;
  result.oldestEligiblePendingAgeMs = snapshot.oldestEligiblePendingAgeMs;

  const batch = await repo.getDueBatch(admin, BATCH_SIZE, connectedVenueIds);

  for (const item of batch) {
    const claimed = await repo.claimQueueItem(admin, item.id);
    if (!claimed) continue; // another processor invocation already took it

    result.processed++;

    // Defence in depth: getDueBatch already excludes unconnected venues, so
    // this only fires if a venue disconnects between selection and claim.
    const connection = await repo.getConnection(admin, item.venue_id);
    if (!connection || connection.status !== "connected") {
      // Not the sync's fault — release without burning an attempt.
      await repo.releaseQueueItem(admin, item.id);
      result.skipped++;
      continue;
    }

    const dependency = await checkDependency(admin, item.entity_type, item.entity_id);
    if (!dependency.ok) {
      await handleFailure(admin, item, dependency.error, true);
      if (item.attempt_count + 1 >= (item.max_attempts ?? MAX_ATTEMPTS)) result.deadLettered++; else result.failedRetrying++;
      continue;
    }

    // Past this line an Intuit call may have happened, so the row stops being
    // eligible for automatic recovery.
    await repo.markDispatchStarted(admin, item.id);

    let syncResult: QuickBooksSyncResult;
    try {
      syncResult = await dispatch(item.venue_id, item.entity_type, item.entity_id);
    } catch (err) {
      // The dispatch marker is already set, so anything thrown past this point
      // — most plausibly an aborted response body on a create that QuickBooks
      // did apply — leaves the outcome unknown. Treat it as uncertain rather
      // than letting it fail the item or abort the rest of the sweep.
      const detail = err instanceof Error ? err.message : "sync threw";
      syncResult = {
        ok: false,
        retryable: false,
        uncertain: true,
        error: `QuickBooks write outcome unknown — ${detail}. Held for review to avoid a duplicate record.`,
      };
    }

    if (syncResult.ok) {
      await handleSuccess(admin, item, syncResult.quickbooksId);
      result.succeeded++;
    } else if (syncResult.uncertain) {
      // Intuit may have applied this write. Leave the claim in place so the
      // lease reports it as needs_review; never retry it automatically.
      await repo.markQueueUncertain(admin, item.id, syncResult.error);
      await repo.insertSyncLog(admin, {
        venueId: item.venue_id, queueId: item.id, entityType: item.entity_type, entityId: item.entity_id,
        outcome: "failed", attemptNumber: item.attempt_count + 1, message: syncResult.error,
      });
      await recordHealthCheck(item.venue_id, false, syncResult.error);
      result.uncertainWrites++;
    } else {
      await handleFailure(admin, item, syncResult.error, syncResult.retryable);
      if (!syncResult.retryable || item.attempt_count + 1 >= (item.max_attempts ?? MAX_ATTEMPTS)) result.deadLettered++;
      else result.failedRetrying++;
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSuccess(admin: any, item: repo.SyncQueueRow, quickbooksId: string): Promise<void> {
  await repo.markQueueSucceeded(admin, item.id);
  await repo.insertSyncLog(admin, {
    venueId: item.venue_id, queueId: item.id, entityType: item.entity_type, entityId: item.entity_id,
    outcome: "succeeded", attemptNumber: item.attempt_count + 1, quickbooksId,
  });

  const table = SYNC_STATUS_TABLE[item.entity_type];
  const idColumn = SYNC_ID_COLUMN[item.entity_type];
  await admin.from(table).update({
    [idColumn]: quickbooksId,
    quickbooks_sync_status: "synced",
    quickbooks_synced_at: new Date().toISOString(),
  }).eq("id", item.entity_id);

  await recordHealthCheck(item.venue_id, true);
}

/**
 * retryable=false (a permanent validation error, or a dependency that will
 * never resolve on its own — though dependency failures are always
 * retryable in practice, see checkDependency) skips straight to
 * dead_letter rather than exhausting attempts pointlessly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFailure(admin: any, item: repo.SyncQueueRow, error: string, retryable: boolean): Promise<void> {
  const nextAttemptCount = item.attempt_count + 1;
  const maxAttempts = item.max_attempts ?? MAX_ATTEMPTS;
  const isDeadLetter = !retryable || nextAttemptCount >= maxAttempts;

  if (isDeadLetter) {
    await repo.markQueueDeadLetter(admin, item.id, nextAttemptCount, error);
    await repo.insertSyncLog(admin, {
      venueId: item.venue_id, queueId: item.id, entityType: item.entity_type, entityId: item.entity_id,
      outcome: "dead_lettered", attemptNumber: nextAttemptCount, message: error,
    });
    const table = SYNC_STATUS_TABLE[item.entity_type];
    await admin.from(table).update({ quickbooks_sync_status: "failed" }).eq("id", item.entity_id);
  } else {
    await repo.markQueueFailedRetrying(admin, item.id, nextAttemptCount, computeNextAttemptAt(nextAttemptCount), error);
    await repo.insertSyncLog(admin, {
      venueId: item.venue_id, queueId: item.id, entityType: item.entity_type, entityId: item.entity_id,
      outcome: "failed", attemptNumber: nextAttemptCount, message: error,
    });
    // Still retrying — the record's own status stays 'pending', not
    // 'failed', so a coordinator never sees a scary badge on something
    // one retry away from succeeding.
  }

  await recordHealthCheck(item.venue_id, false, error);
}
