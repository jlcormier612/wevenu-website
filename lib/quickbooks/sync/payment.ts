/**
 * Payment sync — push a Wevenu payment (a paid payment_line_items row) to
 * QuickBooks as a Payment applied against its already-synced Invoice.
 *
 * Idempotent against QuickBooks itself: QBO's Payment entity has no clean
 * unique free-text field the way Invoice has DocNumber, so our own row ID
 * is embedded in PrivateNote ("wevenu:payment_line_item:<uuid>") and a
 * query-before-create checks for an existing Payment with that PrivateNote
 * before ever POSTing a new one. This is the least-clean idempotency
 * mechanism of the four entity types and needs real sandbox verification
 * the moment credentials exist — if QBO's query API doesn't reliably
 * filter on PrivateNote in practice, the queue's own payload_hash dedup is
 * the fallback guard against a duplicate on a lost-response retry.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type PaymentLineItemRow = {
  schedule_id: string;
  paid_amount: number | null;
};

function escapeQboString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function syncPayment(venueId: string, entityId: string): Promise<QuickBooksSyncResult> {
  const admin = createAdminClient();

  const { data: item } = await admin.from("payment_line_items")
    .select("schedule_id, paid_amount")
    .eq("id", entityId).eq("venue_id", venueId).maybeSingle();
  if (!item) return { ok: false, error: "Payment not found.", retryable: false };
  const itemRow = item as PaymentLineItemRow;

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

  const privateNote = `wevenu:payment_line_item:${entityId}`;
  const query = `select * from Payment where PrivateNote = '${escapeQboString(privateNote)}'`;
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
      PrivateNote: privateNote,
      Line: [{
        Amount: itemRow.paid_amount,
        LinkedTxn: [{ TxnId: invoiceRow.quickbooks_invoice_id, TxnType: "Invoice" }],
      }],
    }),
  });
  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable };

  const createData = await createResult.response.json() as { Payment?: { Id: string } };
  const newId = createData.Payment?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return a Payment id.", retryable: true };

  return { ok: true, quickbooksId: newId };
}
