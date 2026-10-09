/**
 * Payment sync — push a Hello to Cheers payment (a paid payment_line_items row) to
 * QuickBooks as a Payment applied against its already-synced Invoice.
 *
 * Idempotency, in order:
 *   1. Prefer the stored quickbooks_payment_id — no Intuit call.
 *   2. Query by Payment.PaymentRefNum using a short deterministic token
 *      (lib/quickbooks/sync/correlation-token.ts). PrivateNote is not
 *      queryable on Payment (ValidationFault 4001), so it cannot be the
 *      lookup key; it is still written on create for human readability.
 *   3. Create with that PaymentRefNum so a later recovery query can adopt
 *      rather than duplicate.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { paymentCorrelationToken } from "@/lib/quickbooks/sync/correlation-token";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type PaymentLineItemRow = {
  schedule_id: string;
  paid_amount: number | null;
  quickbooks_payment_id: string | null;
};

function escapeQboString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function syncPayment(venueId: string, entityId: string): Promise<QuickBooksSyncResult> {
  const admin = createAdminClient();

  const { data: item } = await admin.from("payment_line_items")
    .select("schedule_id, paid_amount, quickbooks_payment_id")
    .eq("id", entityId).eq("venue_id", venueId).maybeSingle();
  if (!item) return { ok: false, error: "Payment not found.", retryable: false };
  const itemRow = item as PaymentLineItemRow;

  // Cheapest and most reliable guard: the processor already persisted this
  // on a prior success. Returning it here means a re-enqueue never reaches
  // Intuit again once the app knows the remote id.
  if (itemRow.quickbooks_payment_id) {
    return { ok: true, quickbooksId: itemRow.quickbooks_payment_id };
  }

  if (!itemRow.paid_amount || itemRow.paid_amount <= 0) {
    return { ok: false, error: "Payment has no paid amount to sync.", retryable: false };
  }

  const { data: schedule } = await admin.from("payment_schedules")
    .select("invoice_id").eq("id", itemRow.schedule_id).maybeSingle();
  const invoiceId = (schedule as { invoice_id: string | null } | null)?.invoice_id;
  if (!invoiceId) return { ok: false, error: "Payment has no linked invoice to sync against.", retryable: false };

  const { data: invoice } = await admin.from("invoices")
    .select("client_id, quickbooks_invoice_id").eq("id", invoiceId).maybeSingle();
  const invoiceRow = invoice as { client_id: string | null; quickbooks_invoice_id: string | null } | null;
  if (!invoiceRow?.quickbooks_invoice_id) {
    // The processor's dependency check should already have caught this,
    // but a direct call (e.g. a future manual retry) should still fail
    // safely rather than push a payment against no invoice.
    return { ok: false, error: "Invoice not yet synced.", retryable: true };
  }
  if (!invoiceRow.client_id) return { ok: false, error: "Invoice has no client to sync against.", retryable: false };

  const { data: client } = await admin.from("clients")
    .select("quickbooks_customer_id").eq("id", invoiceRow.client_id).maybeSingle();
  const customerId = (client as { quickbooks_customer_id: string | null } | null)?.quickbooks_customer_id;
  if (!customerId) return { ok: false, error: "Customer not yet synced.", retryable: true };

  const correlationToken = paymentCorrelationToken(entityId);
  const privateNote = `htc:payment_line_item:${entityId}`;

  // Lost-response recovery: adopt an existing Payment that carries our token
  // rather than POSTing a second one. PaymentRefNum is the verified-queryable
  // field; PrivateNote is not.
  const query = `select * from Payment where PaymentRefNum = '${escapeQboString(correlationToken)}'`;
  const queryResult = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!queryResult.ok) return { ok: false, error: queryResult.error, retryable: queryResult.retryable };

  const queryData = await queryResult.response.json() as { QueryResponse?: { Payment?: { Id: string }[] } };
  const existingId = queryData.QueryResponse?.Payment?.[0]?.Id;
  if (existingId) return { ok: true, quickbooksId: existingId };

  const createResult = await quickBooksFetch(venueId, "/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CustomerRef: { value: customerId },
      TotalAmt: itemRow.paid_amount,
      PaymentRefNum: correlationToken,
      PrivateNote: privateNote,
      Line: [{
        Amount: itemRow.paid_amount,
        LinkedTxn: [{ TxnId: invoiceRow.quickbooks_invoice_id, TxnType: "Invoice" }],
      }],
    }),
  });
  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable, uncertain: createResult.uncertain };

  const createData = await createResult.response.json() as { Payment?: { Id: string } };
  const newId = createData.Payment?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return a Payment id.", retryable: true };

  return { ok: true, quickbooksId: newId };
}
