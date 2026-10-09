/**
 * Refund sync — push a Hello to Cheers refund (refunded_amount on a payment_line_items
 * row — refunds aren't a separate domain entity in this schema, per TR-M3)
 * to QuickBooks as a RefundReceipt against the same Customer.
 *
 * Idempotency, in order:
 *   1. Prefer the stored quickbooks_refund_id — no Intuit call.
 *   2. Query by RefundReceipt.DocNumber using a short deterministic token
 *      (lib/quickbooks/sync/correlation-token.ts). PrivateNote is not
 *      queryable on RefundReceipt (ValidationFault 4001), so it cannot be
 *      the lookup key; it is still written on create for human readability.
 *   3. Create with that DocNumber so a later recovery query can adopt
 *      rather than duplicate.
 *
 * Every refund pushes under the one "Hello to Cheers Services" placeholder Item
 * (lib/quickbooks/items.ts), same as invoice line items — no chart-of-
 * accounts mapping, explicitly out of scope for launch.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { ensureDefaultItem } from "@/lib/quickbooks/items";
import { refundCorrelationToken } from "@/lib/quickbooks/sync/correlation-token";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type PaymentLineItemRow = {
  schedule_id: string;
  refunded_amount: number;
  label: string;
  quickbooks_refund_id: string | null;
};

function escapeQboString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function syncRefund(venueId: string, entityId: string): Promise<QuickBooksSyncResult> {
  const admin = createAdminClient();

  const { data: item } = await admin.from("payment_line_items")
    .select("schedule_id, refunded_amount, label, quickbooks_refund_id")
    .eq("id", entityId).eq("venue_id", venueId).maybeSingle();
  if (!item) return { ok: false, error: "Payment not found.", retryable: false };
  const itemRow = item as PaymentLineItemRow;

  // Same short-circuit as syncPayment: once the processor has persisted the
  // remote id, a re-enqueue must not reach Intuit again.
  if (itemRow.quickbooks_refund_id) {
    return { ok: true, quickbooksId: itemRow.quickbooks_refund_id };
  }

  if (!itemRow.refunded_amount || itemRow.refunded_amount <= 0) {
    return { ok: false, error: "Payment has no refunded amount to sync.", retryable: false };
  }

  const { data: schedule } = await admin.from("payment_schedules")
    .select("invoice_id").eq("id", itemRow.schedule_id).maybeSingle();
  const invoiceId = (schedule as { invoice_id: string | null } | null)?.invoice_id;
  if (!invoiceId) return { ok: false, error: "Refund has no linked invoice to sync against.", retryable: false };

  const { data: invoice } = await admin.from("invoices")
    .select("client_id, quickbooks_invoice_id").eq("id", invoiceId).maybeSingle();
  const invoiceRow = invoice as { client_id: string | null; quickbooks_invoice_id: string | null } | null;
  if (!invoiceRow?.quickbooks_invoice_id) {
    return { ok: false, error: "Invoice not yet synced.", retryable: true };
  }
  if (!invoiceRow.client_id) return { ok: false, error: "Invoice has no client to sync against.", retryable: false };

  const { data: client } = await admin.from("clients")
    .select("quickbooks_customer_id").eq("id", invoiceRow.client_id).maybeSingle();
  const customerId = (client as { quickbooks_customer_id: string | null } | null)?.quickbooks_customer_id;
  if (!customerId) return { ok: false, error: "Customer not yet synced.", retryable: true };

  const itemResult = await ensureDefaultItem(venueId);
  if (!itemResult.ok) return { ok: false, error: itemResult.error, retryable: itemResult.retryable, uncertain: itemResult.uncertain };

  const correlationToken = refundCorrelationToken(entityId);
  const privateNote = `htc:payment_refund:${entityId}`;

  // Lost-response recovery on the verified-queryable DocNumber field.
  const query = `select * from RefundReceipt where DocNumber = '${escapeQboString(correlationToken)}'`;
  const queryResult = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!queryResult.ok) return { ok: false, error: queryResult.error, retryable: queryResult.retryable };

  const queryData = await queryResult.response.json() as { QueryResponse?: { RefundReceipt?: { Id: string }[] } };
  const existingId = queryData.QueryResponse?.RefundReceipt?.[0]?.Id;
  if (existingId) return { ok: true, quickbooksId: existingId };

  const createResult = await quickBooksFetch(venueId, "/refundreceipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CustomerRef: { value: customerId },
      DocNumber: correlationToken,
      PrivateNote: privateNote,
      Line: [{
        Amount: itemRow.refunded_amount,
        DetailType: "SalesItemLineDetail",
        Description: itemRow.label,
        SalesItemLineDetail: { ItemRef: { value: itemResult.itemId } },
      }],
    }),
  });
  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable, uncertain: createResult.uncertain };

  const createData = await createResult.response.json() as { RefundReceipt?: { Id: string } };
  const newId = createData.RefundReceipt?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return a RefundReceipt id.", retryable: true };

  return { ok: true, quickbooksId: newId };
}
