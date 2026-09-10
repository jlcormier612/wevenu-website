/**
 * Venue-required vendor categories — process configuration.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export async function getVenueRequiredVendorCategories(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_required_vendor_categories")
    .select("category")
    .eq("venue_id", venue.id)
    .order("category");
  return (data ?? []).map((r) => r.category as string);
}

export async function setVenueRequiredVendorCategories(
  categories: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Not signed in." };
  const supabase = await createClient();
  const unique = [...new Set(categories.map((c) => c.trim()).filter(Boolean))];

  const { error: delErr } = await supabase
    .from("venue_required_vendor_categories")
    .delete()
    .eq("venue_id", venue.id);
  if (delErr) return { ok: false, message: delErr.message };

  if (unique.length === 0) return { ok: true };

  const { error: insErr } = await supabase
    .from("venue_required_vendor_categories")
    .insert(unique.map((category) => ({ venue_id: venue.id, category })));
  if (insErr) return { ok: false, message: insErr.message };
  return { ok: true };
}
