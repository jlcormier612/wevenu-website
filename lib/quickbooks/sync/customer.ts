/**
 * Customer sync — push a Wevenu client to QuickBooks as a Customer.
 *
 * Idempotent against QuickBooks itself, not just our own queue: before
 * creating, queries QBO for an existing Customer with the same
 * deterministic DisplayName and adopts its id if found, rather than
 * relying solely on our own queue's dedup (which only prevents duplicate
 * *queue rows*, not duplicate *QBO objects* from a retried-after-lost-
 * response push).
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { quickBooksFetch } from "@/lib/quickbooks/client";
import { clientDisplayName } from "@/lib/clients/constants";
import type { QuickBooksSyncResult } from "@/lib/quickbooks/sync/types";

type ClientRow = {
  first_name: string; last_name: string;
  partner_first_name: string | null; partner_last_name: string | null;
  email: string | null; phone: string | null;
};

function escapeQboString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function syncCustomer(venueId: string, entityId: string): Promise<QuickBooksSyncResult> {
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients")
    .select("first_name, last_name, partner_first_name, partner_last_name, email, phone")
    .eq("id", entityId).eq("venue_id", venueId).maybeSingle();

  if (!client) {
    // The client row is gone (deleted) — not retryable, nothing will ever
    // make this succeed.
    return { ok: false, error: "Client not found.", retryable: false };
  }
  const row = client as ClientRow;
  const displayName = clientDisplayName(row.first_name, row.last_name, row.partner_first_name, row.partner_last_name);
  if (!displayName.trim()) {
    return { ok: false, error: "Client has no name to sync.", retryable: false };
  }

  // Idempotency: does a Customer with this exact DisplayName already exist?
  const query = `select * from Customer where DisplayName = '${escapeQboString(displayName)}'`;
  const queryResult = await quickBooksFetch(venueId, `/query?query=${encodeURIComponent(query)}`);
  if (!queryResult.ok) return { ok: false, error: queryResult.error, retryable: queryResult.retryable };

  const queryData = await queryResult.response.json() as {
    QueryResponse?: { Customer?: { Id: string }[] };
  };
  const existingId = queryData.QueryResponse?.Customer?.[0]?.Id;
  if (existingId) {
    return { ok: true, quickbooksId: existingId };
  }

  const createResult = await quickBooksFetch(venueId, "/customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      DisplayName: displayName,
      PrimaryEmailAddr: row.email ? { Address: row.email } : undefined,
      PrimaryPhone: row.phone ? { FreeFormNumber: row.phone } : undefined,
    }),
  });
  if (!createResult.ok) return { ok: false, error: createResult.error, retryable: createResult.retryable };

  const createData = await createResult.response.json() as { Customer?: { Id: string } };
  const newId = createData.Customer?.Id;
  if (!newId) return { ok: false, error: "QuickBooks did not return a Customer id.", retryable: true };

  return { ok: true, quickbooksId: newId };
}
