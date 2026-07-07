/**
 * Data export service. Server-only.
 * Resolves docs/trust-risk-register.md TR-G2 — a venue owner (or manager)
 * can get a complete, real copy of their own data out of Wevenu on demand.
 * See docs/product-promise.md, "Data Ownership".
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type ExportResult =
  | { ok: true; json: string }
  | { ok: false; message: string };

export async function exportVenueData(): Promise<ExportResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_export", { p_venue_id: venue.id });
  if (error) return { ok: false, message: error.message };
  if (data && typeof data === "object" && "error" in data) {
    return { ok: false, message: "Could not export your data." };
  }
  return { ok: true, json: JSON.stringify(data, null, 2) };
}
