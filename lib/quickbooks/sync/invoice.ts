/**
 * Invoice sync — push a Wevenu invoice to QuickBooks as an Invoice.
 *
 * Idempotent against QuickBooks itself: DocNumber is set to Wevenu's own
 * invoices.invoice_number at creation, and a query-before-create checks
 * for an existing Invoice with that DocNumber before ever POSTing a new
 * one.
 *
 * Every line item pushes under the one "Wevenu Services" placeholder Item
 * (lib/quickbooks/items.ts) — no chart-of-accounts mapping, explicitly out
 * of scope for launch.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { ensureDefaultItem } from "@/lib/quickbooks/items";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type InvoiceRow = {
  client_id: string | null;
  invoice_number: string;
  due_date: string | null;
};

type LineItemRow = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

function escapeQboString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function syncInvoice(venueId: string, entityId: string): Promise<QuickBooksSyncResult> {
  const admin = createAdminClient();

  const { data: invoice } = await admin.from("invoices")
    .select("client_id, invoice_number, due_date")
    .eq("id", entityId).eq("venue_id", venueId).maybeSingle();
  if (!invoice) return { ok: false, error: "Invoice not found.", retryable: false };
  const invoiceRow = invoice as InvoiceRow;

  if (!invoiceRow.client_id) {
    return { ok: false, error: "Invoice has no client to sync against.", retryable: false };
  }

  const { data: client } = await admin.from("clients")
    .select("quickbooks_customer_id").eq("id", invoiceRow.client_id).maybeSingle();
  const customerId = (client as { quickbooks_customer_id: string | null } | null)?.quickbooks_customer_id;
  if (!customerId) {
    // The processor's dependency check should already have caught this,
    // but a direct call (e.g. a future manual retry) should still fail
    // safely rather than push an invoice with no customer.
    return { ok: false, error: "Customer not yet synced.", retryable: true };
  }

  const { data: lineItems } = await admin.from("invoice_line_items")
    .select("description, quantity, unit_price, amount")
    .eq("invoice_id", entityId).order("sort_order");
  const lines = (lineItems ?? []) as LineItemRow[];
  if (lines.length === 0) {
    return { ok: false, error: "Invoice has no line items to sync.", retryable: true };
  }

  const itemResult = await ensureDefaultItem(venueId);
  if (!itemResult.ok) return { ok: false, error: itemResult.error, retryable: itemResult.retryable };

  // Idempotency: does an Invoice with this exact DocNumber already exist?
  const query = `select * from Invoice where DocNumber = '${escapeQboString(invoiceRow.invoice_number)}'`;
  const queryResult = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!queryResult.ok) return { ok: false, error: queryResult.error, retryable: queryResult.retryable };

  const queryData = await queryResult.response.json() as { QueryResponse?: { Invoice?: { Id: string }[] } };
  const existingId = queryData.QueryResponse?.Invoice?.[0]?.Id;
  if (existingId) {
    return { ok: true, quickbooksId: existingId };
  }

  const createResult = await quickBooksFetch(venueId, "/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CustomerRef: { value: customerId },
      DocNumber: invoiceRow.invoice_number,
      DueDate: invoiceRow.due_date ?? undefined,
      Line: lines.map((line) => ({
        Amount: line.amount,
        DetailType: "SalesItemLineDetail",
        Description: line.description,
        SalesItemLineDetail: {
          ItemRef: { value: itemResult.itemId },
          Qty: line.quantity,
          UnitPrice: line.unit_price,
        },
      })),
    }),
  });
  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable };

  const createData = await createResult.response.json() as { Invoice?: { Id: string } };
  const newId = createData.Invoice?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return an Invoice id.", retryable: true };

  return { ok: true, quickbooksId: newId };
}
