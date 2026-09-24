/**
 * The one customer-facing answer to "is this relationship booked?"
 *
 * `events.booked_at` is written only by `bookClient` — the one Lead →
 * Booked transition (manual Mark as Booked / Return to Booked / pipeline
 * Booked actions). Payment completion and commercial agreement milestones
 * do NOT stamp Booked.
 *
 * Clients, Booked Business, and calendar "officially booked" consume this
 * set. They must not re-derive booked from pipeline stage, client status,
 * payment status, or commercial preferences.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export async function getCanonicallyBookedClientIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const venue = await getCurrentVenue();
  if (!venue) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("client_id")
    .eq("venue_id", venue.id)
    .not("booked_at", "is", null)
    .neq("status", "cancelled");
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of (data ?? []) as { client_id: string | null }[]) {
    if (row.client_id) ids.add(row.client_id);
  }
  return ids;
}
