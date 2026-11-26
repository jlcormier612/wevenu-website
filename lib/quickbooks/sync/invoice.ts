/**
 * Invoice sync — push a Hello to Cheers invoice to QuickBooks as an Invoice.
 *
 * Idempotent against QuickBooks itself: DocNumber is set to Hello to Cheers'
 * invoices.invoice_number at creation, and a query-before-create checks
 * for an existing Invoice with that DocNumber before ever POSTing a new
 * one.
 *
 * Line mapping follows the US QBO tax model (TAX/NON + DiscountLineDetail).
 * Taxable invoices that QuickBooks rejects fail clearly — there is no fallback
 * that posts tax as revenue or drops tax from the total.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { ensureDefaultItem } from "@/lib/quickbooks/items";
import {
  buildQuickBooksInvoiceLinePayload,
  type HtcInvoiceLineItem,
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

function totalsMatch(expected: number, actual: number): boolean {
  return Math.abs(expected - actual) <= 0.01;
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

  const queryData = await queryResult.response.json() as {
    QueryResponse?: { Invoice?: { Id: string; TotalAmt?: number }[] };
  };
  const existing = queryData.QueryResponse?.Invoice?.[0];
  if (existing?.Id) {
    return { ok: true, quickbooksId: existing.Id };
  }

  const mapped = buildQuickBooksInvoiceLinePayload(lines, itemResult.itemId);
  if (mapped.Line.length === 0) {
    return { ok: false, error: "Invoice has no QuickBooks-syncable line items.", retryable: false };
  }

  const createResult = await quickBooksFetch(venueId, "/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CustomerRef: { value: customerId },
      DocNumber: invoiceRow.invoice_number,
      DueDate: invoiceRow.due_date ?? undefined,
      GlobalTaxCalculation: mapped.GlobalTaxCalculation,
      Line: mapped.Line,
    }),
  });

  if (!createResult.ok) {
    const taxHint = mapped.taxable
      ? " Taxable Hello to Cheers invoices require QuickBooks US sales tax (TAX/NON) to accept the invoice; tax was not posted as revenue and was not dropped."
      : "";
    return {
      ok: false,
      error: `${createResult.error}${taxHint}`,
      retryable: createResult.retryable,
      uncertain: createResult.uncertain,
    };
  }

  const createData = await createResult.response.json() as {
    Invoice?: { Id: string; TotalAmt?: number; TxnTaxDetail?: { TotalTax?: number } };
  };
  const created = createData.Invoice;
  const newId = created?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return an Invoice id.", retryable: true };

  const qboTotal = Number(created?.TotalAmt);
  if (Number.isFinite(qboTotal) && !totalsMatch(mapped.expectedTotal, qboTotal)) {
    const qboTax = created?.TxnTaxDetail?.TotalTax;
    return {
      ok: false,
      error:
        `QuickBooks invoice total ${qboTotal.toFixed(2)} does not match Hello to Cheers total ` +
        `${mapped.expectedTotal.toFixed(2)}` +
        (mapped.taxable
          ? ` (HTC tax ${mapped.htcTaxAmount.toFixed(2)}` +
            (qboTax != null ? `, QBO tax ${Number(qboTax).toFixed(2)}` : "") +
            `). Align the QuickBooks sales tax rate with the venue tax, then retry. ` +
            `The remote invoice ${newId} was created and will be adopted by DocNumber on retry — it was not rewritten with misclassified tax.`
          : "."),
      retryable: false,
    };
  }

  return { ok: true, quickbooksId: newId };
}
