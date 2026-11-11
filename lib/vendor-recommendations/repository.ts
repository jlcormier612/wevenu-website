import { createClient } from "@/integrations/supabase/server";
import type { EventVendorRecommendation } from "@/lib/vendor-recommendations/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type Row = {
  id: string; venue_id: string; event_id: string; vendor_id: string;
  note: string | null; recommended_at: string; selected_at: string | null; created_at: string;
  vendors: { business_name: string; category: string | null } | null;
};

function mapRow(r: Row): EventVendorRecommendation {
  return {
    id: r.id, venueId: r.venue_id, eventId: r.event_id, vendorId: r.vendor_id,
    note: r.note, recommendedAt: r.recommended_at, selectedAt: r.selected_at, createdAt: r.created_at,
    vendorName: r.vendors?.business_name ?? "Vendor", vendorCategory: r.vendors?.category ?? null,
  };
}

export async function getEventRecommendations(client: DbClient, venueId: string, eventId: string): Promise<EventVendorRecommendation[]> {
  const { data, error } = await client.from("event_vendor_recommendations")
    .select("*, vendors(business_name, category)")
    .eq("venue_id", venueId).eq("event_id", eventId)
    .order("recommended_at");
  if (error) throw error;
  return (data as unknown as Row[]).map(mapRow);
}

export async function addRecommendation(client: DbClient, venueId: string, eventId: string, vendorId: string, note: string | null): Promise<void> {
  const { error } = await client.from("event_vendor_recommendations")
    .insert({ venue_id: venueId, event_id: eventId, vendor_id: vendorId, note: note?.trim() || null });
  if (error && error.code !== "23505") throw error; // already recommended — no-op
}

export async function removeRecommendation(client: DbClient, venueId: string, recommendationId: string): Promise<void> {
  const { error } = await client.from("event_vendor_recommendations")
    .delete().eq("id", recommendationId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateRecommendationNote(
  client: DbClient,
  venueId: string,
  recommendationId: string,
  note: string | null,
): Promise<void> {
  const { error } = await client.from("event_vendor_recommendations")
    .update({ note: note?.trim() || null })
    .eq("id", recommendationId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

/** Active/invited Network rows used to seed event recommendations (venue-scoped). */
export async function listNetworkVendorsForRecommendationSeed(
  client: DbClient,
  venueId: string,
): Promise<Array<{ vendorId: string; status: string; preferenceLevel: string; isRequired: boolean }>> {
  const { data, error } = await client
    .from("venue_vendor_relationships")
    .select("vendor_id, status, preference_level, is_required")
    .eq("venue_id", venueId)
    .neq("status", "inactive");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    vendorId: r.vendor_id as string,
    status: (r.status as string) ?? "inactive",
    preferenceLevel: (r.preference_level as string) ?? "standard",
    isRequired: r.is_required === true,
  }));
}

export async function insertRecommendationsIfMissing(
  client: DbClient,
  venueId: string,
  eventId: string,
  vendorIds: readonly string[],
): Promise<number> {
  if (vendorIds.length === 0) return 0;
  const rows = vendorIds.map((vendorId) => ({
    venue_id: venueId,
    event_id: eventId,
    vendor_id: vendorId,
    note: null as string | null,
    source: "venue",
  }));
  const { data, error } = await client
    .from("event_vendor_recommendations")
    .upsert(rows, { onConflict: "event_id,vendor_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
