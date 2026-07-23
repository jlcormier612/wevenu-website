/**
 * The "Hello to Cheers Services" placeholder QBO Item — how invoice line items push
 * without chart-of-accounts mapping (explicitly out of scope for launch).
 * Every invoice line item pushes under this one generic Item regardless of
 * invoice_line_items.type ('package'/'addon'/'inventory'/'discount'/'fee'/
 * 'tax'/'deposit'/'item') — QBO assigns its own default income account,
 * the one place account selection is intentionally left to QBO rather
 * than mapped.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { QUICKBOOKS_DEFAULT_ITEM_NAME } from "@/lib/quickbooks/config";
import * as repo from "@/lib/quickbooks/repository";

export type EnsureItemResult = { ok: true; itemId: string } | { ok: false; error: string; retryable: boolean };

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

  const createResult = await quickBooksFetch(venueId, "/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Name: QUICKBOOKS_DEFAULT_ITEM_NAME, Type: "Service" }),
  });
  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable };

  const createData = await createResult.response.json() as { Item?: { Id: string } };
  const newId = createData.Item?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return an Item id.", retryable: true };

  await repo.setDefaultItemId(admin, venueId, newId);
  return { ok: true, itemId: newId };
}
