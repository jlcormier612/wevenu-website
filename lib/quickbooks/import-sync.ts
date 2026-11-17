/**
 * Deliberate post-migration QuickBooks customer sync.
 *
 * Import-origin client creates do not enqueue automatically. After the venue
 * has connected QuickBooks and chosen to sync, call this with the venue id.
 * It no-ops when QuickBooks is not configured or the venue has no connection.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { isQuickBooksConfigured } from "@/lib/quickbooks/config";
import { enqueueQuickBooksSync } from "@/lib/quickbooks/queue";
import { getConnection } from "@/lib/quickbooks/repository";

export async function enqueueExistingCustomersForQuickBooks(venueId: string): Promise<{
  ok: true;
  queued: number;
  skippedReason: string | null;
}> {
  if (!isQuickBooksConfigured()) {
    return { ok: true, queued: 0, skippedReason: "QuickBooks is not configured." };
  }
  const admin = createAdminClient();
  const connection = await getConnection(admin, venueId);
  if (!connection || connection.status !== "connected") {
    return { ok: true, queued: 0, skippedReason: "This venue has not connected QuickBooks." };
  }
  const { data, error } = await admin
    .from("clients")
    .select("id, first_name, last_name, partner_first_name, partner_last_name, email, phone")
    .eq("venue_id", venueId)
    .neq("status", "cancelled");
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    partner_first_name: string | null;
    partner_last_name: string | null;
    email: string | null;
    phone: string | null;
  }[];
  for (const row of rows) {
    await enqueueQuickBooksSync(venueId, "customer", row.id, {
      firstName: row.first_name,
      lastName: row.last_name,
      partnerFirstName: row.partner_first_name,
      partnerLastName: row.partner_last_name,
      email: row.email,
      phone: row.phone,
    });
  }
  return { ok: true, queued: rows.length, skippedReason: null };
}
