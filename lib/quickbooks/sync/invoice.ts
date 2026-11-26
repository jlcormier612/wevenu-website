/**
 * Invoice sync — push a Hello to Cheers invoice to QuickBooks as an Invoice.
 *
 * Idempotent against QuickBooks itself: DocNumber is set to Hello to Cheers'
 * invoices.invoice_number at creation, and a query-before-create checks
 * for an existing Invoice with that DocNumber before ever POSTing a new
 * one.
 *
 * Every line item pushes under the one "Hello to Cheers Services" placeholder Item
 * (lib/quickbooks/items.ts) — no chart-of-accounts mapping, explicitly out
 * of scope for launch.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { ensureDefaultItem } from "@/lib/quickbooks/items";
import {
  buildQuickBooksInvoiceLinePayload,
  type HtcInvoiceLineItem,
  type QuickBooksInvoiceLine,
} from "@/lib/quickbooks/sync/invoice-line-payload";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type InvoiceRow = {
  client_id: string | null;
  invoice_number: string;
  due_date: string | null;
};

type LineItemRow = HtcInvoiceLineItem;

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
    .select("type, description, quantity, unit_price, amount")
    .eq("invoice_id", entityId).order("sort_order");
  const lines = (lineItems ?? []) as LineItemRow[];
  if (lines.length === 0) {
    return { ok: false, error: "Invoice has no line items to sync.", retryable: true };
  }

  const itemResult = await ensureDefaultItem(venueId);
  if (!itemResult.ok) return { ok: false, error: itemResult.error, retryable: itemResult.retryable, uncertain: itemResult.uncertain };

  // Idempotency: does an Invoice with this exact DocNumber already exist?
  const query = `select * from Invoice where DocNumber = '${escapeQboString(invoiceRow.invoice_number)}'`;
  const queryResult = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!queryResult.ok) return { ok: false, error: queryResult.error, retryable: queryResult.retryable };

  const queryData = await queryResult.response.json() as { QueryResponse?: { Invoice?: { Id: string }[] } };
  const existingId = queryData.QueryResponse?.Invoice?.[0]?.Id;
  if (existingId) {
    return { ok: true, quickbooksId: existingId };
  }

  const mapped = buildQuickBooksInvoiceLinePayload(lines, itemResult.itemId);
  if (mapped.Line.length === 0) {
    return { ok: false, error: "Invoice has no QuickBooks-syncable line items.", retryable: false };
  }

  const baseBody: Record<string, unknown> = {
    CustomerRef: { value: customerId },
    DocNumber: invoiceRow.invoice_number,
    DueDate: invoiceRow.due_date ?? undefined,
    // HTC computes tax/discount; do not ask QBO to recalculate sales tax.
    GlobalTaxCalculation: "NotApplicable",
    Line: mapped.Line,
  };
  if (mapped.TxnTaxDetail) {
    baseBody.TxnTaxDetail = mapped.TxnTaxDetail;
  }

  let createResult = await quickBooksFetch(venueId, "/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(baseBody),
  });

  // Subscription / tax-feature loss: if TxnTaxDetail is rejected, fall back to
  // non-tax-coded sales lines for the tax amount so invoice totals still match
  // payments — without enabling QBO automated sales tax on revenue lines.
  if (!createResult.ok && mapped.totalTax > 0) {
    const taxFallbackLines: QuickBooksInvoiceLine[] = [
      ...mapped.Line,
      ...lines
        .filter((line) => (line.type ?? "").trim().toLowerCase() === "tax")
        .map((line) => ({
          Amount: Number(line.amount) || 0,
          DetailType: "SalesItemLineDetail" as const,
          Description: line.description?.trim() || "Sales tax",
          SalesItemLineDetail: {
            ItemRef: { value: itemResult.itemId },
            Qty: Number(line.quantity) || 1,
            UnitPrice: Number(line.unit_price) || Number(line.amount) || 0,
          },
        })),
    ];
    const { TxnTaxDetail: _ignored, ...withoutTaxDetail } = baseBody;
    createResult = await quickBooksFetch(venueId, "/invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...withoutTaxDetail,
        Line: taxFallbackLines,
      }),
    });
  }

  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable, uncertain: createResult.uncertain };

  const createData = await createResult.response.json() as { Invoice?: { Id: string } };
  const newId = createData.Invoice?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return an Invoice id.", retryable: true };

  return { ok: true, quickbooksId: newId };
}
