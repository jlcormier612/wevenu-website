/**
 * Refund sync — reconcile the existing QuickBooks Payment to HTC net retained
 * collections after a refund on payment_line_items.
 *
 * Invoice-linked path only (this version):
 *   target = paid_amount − refunded_amount
 *   target > 0  → full Payment update (TotalAmt + invoice Line.Amount)
 *   target = 0  → Payment void (after confirming it is not in a Bank Deposit)
 *
 * Idempotency:
 *   1. Cache short-circuit when quickbooks_refund_net_synced === target
 *      (cache only — never the sole truth when a write is required).
 *   2. GET Payment by quickbooks_payment_id; adopt if remote already matches.
 *   3. Otherwise update or void with the current SyncToken.
 *   4. Stale SyncToken → re-GET once; retry write only if still mismatched.
 *   5. Uncertain write outcomes are not blindly retried (processor holds them).
 *
 * RefundReceipt is intentionally not created for invoice-linked payments —
 * it does not unapply a Payment or raise Invoice open balance.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import {
  buildPaymentReconcileUpdateBody,
  buildPaymentVoidBody,
  computeNetRetained,
  DEPOSIT_SCAN_MAX_RESULTS,
  DEPOSIT_STATUS_UNCONFIRMED,
  evaluateDepositScan,
  isStaleSyncTokenError,
  moneyEquals,
  paymentMatchesTarget,
  type QboPayment,
} from "@/lib/quickbooks/sync/refund-reconcile";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type PaymentLineItemRow = {
  schedule_id: string;
  paid_amount: number | null;
  refunded_amount: number | null;
  quickbooks_payment_id: string | null;
  quickbooks_refund_net_synced: number | null;
};

async function readPayment(venueId: string, paymentId: string): Promise<
  | { ok: true; payment: QboPayment }
  | { ok: false; error: string; retryable: boolean }
> {
  const result = await quickBooksFetch(venueId, `/payment/${encodeURIComponent(paymentId)}`);
  if (!result.ok) return { ok: false, error: result.error, retryable: result.retryable };
  const data = await result.response.json() as { Payment?: QboPayment };
  if (!data.Payment?.Id || data.Payment.SyncToken == null) {
    return { ok: false, error: "QuickBooks did not return a Payment.", retryable: true };
  }
  return { ok: true, payment: data.Payment };
}

/**
 * Confirm the Payment is not in a Bank Deposit before any update or void.
 * Fail closed: capped scans, malformed payloads, and query failures refuse
 * the write rather than guessing.
 */
async function assertPaymentNotInBankDeposit(
  venueId: string,
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  const query = `select * from Deposit MAXRESULTS ${DEPOSIT_SCAN_MAX_RESULTS}`;
  const result = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!result.ok) {
    return { ok: false, error: DEPOSIT_STATUS_UNCONFIRMED, retryable: false };
  }
  let data: { QueryResponse?: { Deposit?: unknown } };
  try {
    data = await result.response.json() as { QueryResponse?: { Deposit?: unknown } };
  } catch {
    return { ok: false, error: DEPOSIT_STATUS_UNCONFIRMED, retryable: false };
  }
  if (!data || typeof data !== "object" || !("QueryResponse" in data) || data.QueryResponse == null) {
    return { ok: false, error: DEPOSIT_STATUS_UNCONFIRMED, retryable: false };
  }
  // Intuit omits Deposit when the company has zero deposits; normalize to [] so
  // the helper treats a validated empty result as clear, not ambiguous null.
  const verdict = evaluateDepositScan(data.QueryResponse.Deposit ?? [], paymentId);
  if (verdict === "found") {
    return {
      ok: false,
      error:
        "This QuickBooks Payment is included in a Bank Deposit. "
        + "Remove it from the deposit in QuickBooks before the refund can sync.",
      retryable: false,
    };
  }
  if (verdict === "ambiguous") {
    return { ok: false, error: DEPOSIT_STATUS_UNCONFIRMED, retryable: false };
  }
  return { ok: true };
}

function success(paymentId: string, target: number): QuickBooksSyncResult {
  return { ok: true, quickbooksId: paymentId, refundNetSynced: target };
}

async function applyReconcileWrite(
  venueId: string,
  payment: QboPayment,
  target: number,
  invoiceQuickBooksId: string,
): Promise<QuickBooksSyncResult> {
  // Same gate for partial update and full void — never mutate a deposited Payment.
  const depositGate = await assertPaymentNotInBankDeposit(venueId, String(payment.Id));
  if (!depositGate.ok) {
    return { ok: false, error: depositGate.error, retryable: depositGate.retryable };
  }

  if (target <= 0) {
    const voidResult = await quickBooksFetch(
      venueId,
      "/payment?operation=update&include=void",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPaymentVoidBody(payment)),
      },
    );
    if (!voidResult.ok) {
      return {
        ok: false,
        error: voidResult.error,
        retryable: /deposit/i.test(voidResult.error) ? false : voidResult.retryable,
        uncertain: voidResult.uncertain,
      };
    }
    return success(String(payment.Id), 0);
  }

  const updateResult = await quickBooksFetch(venueId, "/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPaymentReconcileUpdateBody(payment, target, invoiceQuickBooksId)),
  });
  if (!updateResult.ok) {
    return {
      ok: false,
      error: updateResult.error,
      retryable: /deposit/i.test(updateResult.error) ? false : updateResult.retryable,
      uncertain: updateResult.uncertain,
    };
  }
  return success(String(payment.Id), target);
}

export async function syncRefund(venueId: string, entityId: string): Promise<QuickBooksSyncResult> {
  const admin = createAdminClient();

  const { data: item } = await admin.from("payment_line_items")
    .select(
      "schedule_id, paid_amount, refunded_amount, quickbooks_payment_id, quickbooks_refund_net_synced",
    )
    .eq("id", entityId).eq("venue_id", venueId).maybeSingle();
  if (!item) return { ok: false, error: "Payment not found.", retryable: false };
  const itemRow = item as PaymentLineItemRow;

  const paidAmount = Number(itemRow.paid_amount ?? 0);
  const refundedAmount = Number(itemRow.refunded_amount ?? 0);
  if (!(refundedAmount > 0)) {
    return { ok: false, error: "Payment has no refunded amount to sync.", retryable: false };
  }
  if (!(paidAmount > 0)) {
    return { ok: false, error: "Payment has no paid amount to reconcile against.", retryable: false };
  }

  const target = computeNetRetained(paidAmount, refundedAmount);

  // Cache of a previously confirmed remote match — skip Intuit when unchanged.
  if (
    itemRow.quickbooks_refund_net_synced != null
    && moneyEquals(Number(itemRow.quickbooks_refund_net_synced), target)
    && itemRow.quickbooks_payment_id
  ) {
    return success(itemRow.quickbooks_payment_id, target);
  }

  if (!itemRow.quickbooks_payment_id) {
    return {
      ok: false,
      error:
        "This payment has not been synced to QuickBooks yet, so the refund "
        + "cannot reconcile a Payment. Sync the payment first.",
      retryable: false,
    };
  }

  const { data: schedule } = await admin.from("payment_schedules")
    .select("invoice_id").eq("id", itemRow.schedule_id).maybeSingle();
  const invoiceId = (schedule as { invoice_id: string | null } | null)?.invoice_id;
  if (!invoiceId) {
    return {
      ok: false,
      error: "Refund sync for payments without a linked invoice is not supported in this version.",
      retryable: false,
    };
  }

  const { data: invoice } = await admin.from("invoices")
    .select("quickbooks_invoice_id").eq("id", invoiceId).maybeSingle();
  const invoiceQuickBooksId = (invoice as { quickbooks_invoice_id: string | null } | null)?.quickbooks_invoice_id;
  if (!invoiceQuickBooksId) {
    return { ok: false, error: "Invoice not yet synced.", retryable: true };
  }

  const firstRead = await readPayment(venueId, itemRow.quickbooks_payment_id);
  if (!firstRead.ok) return { ok: false, error: firstRead.error, retryable: firstRead.retryable };

  if (paymentMatchesTarget(firstRead.payment, target, invoiceQuickBooksId)) {
    return success(itemRow.quickbooks_payment_id, target);
  }

  let write = await applyReconcileWrite(venueId, firstRead.payment, target, invoiceQuickBooksId);
  if (write.ok) return write;
  if (write.uncertain) return write;

  // Stale SyncToken: re-read once. Retry the write only when remote still
  // mismatches the ledger target (otherwise adopt).
  if (isStaleSyncTokenError(write.error)) {
    const secondRead = await readPayment(venueId, itemRow.quickbooks_payment_id);
    if (!secondRead.ok) return { ok: false, error: secondRead.error, retryable: secondRead.retryable };
    if (paymentMatchesTarget(secondRead.payment, target, invoiceQuickBooksId)) {
      return success(itemRow.quickbooks_payment_id, target);
    }
    write = await applyReconcileWrite(venueId, secondRead.payment, target, invoiceQuickBooksId);
    return write;
  }

  // Deposit-related business validation on update/void → non-retryable.
  if (/deposit/i.test(write.error) && !write.retryable) {
    return write;
  }
  if (/deposit/i.test(write.error)) {
    return {
      ok: false,
      error: write.error,
      retryable: false,
    };
  }

  return write;
}
