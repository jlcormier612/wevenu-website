/**
 * The "Hello to Cheers Services" placeholder QBO Item — how invoice line items push
 * without chart-of-accounts mapping (explicitly out of scope for launch).
 * Every invoice line item pushes under this one generic Item regardless of
 * invoice_line_items.type ('package'/'addon'/'inventory'/'discount'/'fee'/
 * 'tax'/'deposit'/'item').
 *
 * This file used to claim QBO assigned the Item's income account itself, so
 * no account selection was needed. That was wrong, and it broke every
 * first-time invoice and refund sync: QuickBooks rejects a Service Item with
 * no account reference outright (400 ValidationFault code 2020, "Required
 * parameter ExpenseAccountRef or IncomeAccountRef is missing"), and exposes
 * no default to fall back on. The venue therefore picks one income account
 * in Settings and it is required here — see lib/quickbooks/income-accounts.ts
 * for why nothing picks one automatically.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { QUICKBOOKS_DEFAULT_ITEM_NAME } from "@/lib/quickbooks/config";
import * as repo from "@/lib/quickbooks/repository";

export type EnsureItemResult =
  | { ok: true; itemId: string }
  | { ok: false; error: string; retryable: boolean; uncertain?: boolean };

export async function ensureDefaultItem(venueId: string): Promise<EnsureItemResult> {
  const admin = createAdminClient();
  const connection = await repo.getConnectionWithTokens(admin, venueId);
  if (connection?.defaultItemQuickBooksId) {
    return { ok: true, itemId: connection.defaultItemQuickBooksId };
  }

  const escapedName = QUICKBOOKS_DEFAULT_ITEM_NAME.replace(/'/g, "''");
  const query = `select * from Item where Name = '${escapedName}'`;
  const queryResult = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!queryResult.ok) return { ok: false, error: queryResult.error, retryable: queryResult.retryable };

  const queryData = await queryResult.response.json() as { QueryResponse?: { Item?: { Id: string }[] } };
  const existingId = queryData.QueryResponse?.Item?.[0]?.Id;
  if (existingId) {
    await repo.setDefaultItemId(admin, venueId, existingId);
    return { ok: true, itemId: existingId };
  }

  // Only a *create* needs the account, so adoption above still works for a
  // company that already has the Item. Checked before the POST so a venue
  // that hasn't chosen yet gets an actionable instruction instead of Intuit's
  // raw validation fault, and so no mutating request is ever sent without one.
  const incomeAccountId = connection?.defaultIncomeAccountQuickBooksId;
  if (!incomeAccountId) {
    return {
      ok: false,
      error:
        "QuickBooks needs an income account before invoices can sync. " +
        "Open Settings → Integrations → QuickBooks Online and choose which " +
        "income account your event revenue should post to.",
      retryable: false,
    };
  }

  const createResult = await quickBooksFetch(venueId, "/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Name: QUICKBOOKS_DEFAULT_ITEM_NAME,
      Type: "Service",
      IncomeAccountRef: { value: incomeAccountId },
    }),
  });
  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable, uncertain: createResult.uncertain };

  const createData = await createResult.response.json() as { Item?: { Id: string } };
  const newId = createData.Item?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return an Item id.", retryable: true };

  await repo.setDefaultItemId(admin, venueId, newId);
  return { ok: true, itemId: newId };
}
