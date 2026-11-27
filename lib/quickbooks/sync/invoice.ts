/**
 * Invoice sync — push a Hello to Cheers invoice to QuickBooks as an Invoice.
 *
 * Idempotent against QuickBooks itself: DocNumber is set to Hello to Cheers'
 * invoices.invoice_number at creation, and a query-before-create checks
 * for an existing Invoice with that DocNumber before ever POSTing a new
 * one. Existing matches are still total-checked so a prior mismatched create
 * is never silently adopted as synced.
 *
 * Line mapping follows the US QBO tax model (TAX/NON + DiscountLineDetail).
 * Taxable invoices also set TxnTaxDetail.TxnTaxCodeRef from the company
 * Preferences.TaxPrefs.TaxGroupCodeRef so QBO calculates sales tax. Taxable
 * invoices that QuickBooks rejects or totals that do not match fail clearly —
 * there is no fallback that posts tax as revenue or drops tax from the total.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { ensureDefaultItem } from "@/lib/quickbooks/items";
import { resolveCompanySalesTaxCodeRef } from "@/lib/quickbooks/sales-tax";
import {
  buildQuickBooksInvoiceLinePayload,
  type HtcInvoiceLineItem,
  type QuickBooksInvoiceLinePayload,
} from "@/lib/quickbooks/sync/invoice-line-payload";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type InvoiceRow = {
  client_id: string | null;
  invoice_number: string;
  due_date: string | null;
};

type LineItemRow = HtcInvoiceLineItem;

type QboInvoiceTotals = {
  Id: string;
  TotalAmt?: number;
  TxnTaxDetail?: { TotalTax?: number };
};

function escapeQboString(value: string): string {
  return value.replace(/'/g, "''");
}

function totalsMatch(expected: number, actual: number): boolean {
  return Math.abs(expected - actual) <= 0.01;
}

function totalMismatchError(
  mapped: QuickBooksInvoiceLinePayload,
  qbo: QboInvoiceTotals,
  opts?: { adopted?: boolean },
): QuickBooksSyncResult {
  const qboTotal = Number(qbo.TotalAmt);
  const qboTax = qbo.TxnTaxDetail?.TotalTax;
  const adoptNote = opts?.adopted
    ? ` Existing QuickBooks invoice ${qbo.Id} was not adopted as synced because totals do not match.`
    : ` The remote invoice ${qbo.Id} was created; fix the tax alignment, then retry — it was not rewritten with misclassified tax.`;
  return {
    ok: false,
    error:
      `QuickBooks invoice total ${qboTotal.toFixed(2)} does not match Hello to Cheers total ` +
      `${mapped.expectedTotal.toFixed(2)}` +
      (mapped.taxable
        ? ` (HTC tax ${mapped.htcTaxAmount.toFixed(2)}` +
          (qboTax != null ? `, QBO tax ${Number(qboTax).toFixed(2)}` : "") +
          `). Align the QuickBooks sales tax rate and taxable base with the venue tax, then retry.` +
          adoptNote
        : "."),
    retryable: false,
  };
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
    // Deterministic data defect — retrying until max_attempts only burns the
    // queue and flips Settings health. Dead-letter instead.
    return { ok: false, error: "Invoice has no line items to sync.", retryable: false };
  }

  const itemResult = await ensureDefaultItem(venueId);
  if (!itemResult.ok) return { ok: false, error: itemResult.error, retryable: itemResult.retryable, uncertain: itemResult.uncertain };

  const mapped = buildQuickBooksInvoiceLinePayload(lines, itemResult.itemId);
  if (mapped.Line.length === 0) {
    return { ok: false, error: "Invoice has no QuickBooks-syncable line items.", retryable: false };
  }

  let txnTaxDetail: { TxnTaxCodeRef: { value: string } } | undefined;
  if (mapped.taxable) {
    const taxCode = await resolveCompanySalesTaxCodeRef(venueId);
    if (!taxCode.ok) {
      return {
        ok: false,
        error:
          `${taxCode.error} Taxable Hello to Cheers invoices require QuickBooks US sales tax ` +
          `(TAX/NON + company TaxGroupCodeRef); tax was not posted as revenue and was not dropped.`,
        retryable: taxCode.retryable,
      };
    }
    txnTaxDetail = { TxnTaxCodeRef: { value: taxCode.taxCodeId } };
  }

  // Idempotency: does an Invoice with this exact DocNumber already exist?
  const query = `select * from Invoice where DocNumber = '${escapeQboString(invoiceRow.invoice_number)}'`;
  const queryResult = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!queryResult.ok) return { ok: false, error: queryResult.error, retryable: queryResult.retryable };

  const queryData = await queryResult.response.json() as {
    QueryResponse?: { Invoice?: QboInvoiceTotals[] };
  };
  const existing = queryData.QueryResponse?.Invoice?.[0];
  const existingId = existing?.Id;
  if (existingId && existing) {
    const qboTotal = Number(existing.TotalAmt);
    if (Number.isFinite(qboTotal) && !totalsMatch(mapped.expectedTotal, qboTotal)) {
      return totalMismatchError(mapped, existing, { adopted: true });
    }
    return { ok: true, quickbooksId: existingId };
  }

  const createResult = await quickBooksFetch(venueId, "/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CustomerRef: { value: customerId },
      DocNumber: invoiceRow.invoice_number,
      DueDate: invoiceRow.due_date ?? undefined,
      GlobalTaxCalculation: mapped.GlobalTaxCalculation,
      ...(txnTaxDetail ? { TxnTaxDetail: txnTaxDetail } : {}),
      Line: mapped.Line,
    }),
  });

  if (!createResult.ok) {
    const taxHint = mapped.taxable
      ? " Taxable Hello to Cheers invoices require QuickBooks US sales tax (TAX/NON + company TaxGroupCodeRef) to accept the invoice; tax was not posted as revenue and was not dropped."
      : "";
    return {
      ok: false,
      error: `${createResult.error}${taxHint}`,
      retryable: createResult.retryable,
      uncertain: createResult.uncertain,
    };
  }

  const createData = await createResult.response.json() as {
    Invoice?: QboInvoiceTotals;
  };
  const created = createData.Invoice;
  const newId = created?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return an Invoice id.", retryable: true };

  const qboTotal = Number(created?.TotalAmt);
  if (Number.isFinite(qboTotal) && !totalsMatch(mapped.expectedTotal, qboTotal)) {
    return totalMismatchError(mapped, created!);
  }

  return { ok: true, quickbooksId: newId };
}
