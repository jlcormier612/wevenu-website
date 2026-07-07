import { createClient } from "@/integrations/supabase/server";
import type { RawRecommendationRow, VenueRecommendation } from "./recommendation-types";

export async function getVenueRecommendations(): Promise<VenueRecommendation[]> {
  try {
    const supabase = await createClient();
    await supabase.rpc("generate_venue_recommendations");
    const { data, error } = await supabase.rpc("get_venue_recommendations");
    if (error || !data) return [];
    return (data as RawRecommendationRow[]).map(row => ({
      id:          row.id,
      insightId:   row.insight_id,
      type:        row.type,
      title:       row.title,
      body:        row.body,
      priority:    row.priority,
      ctas:        row.ctas        ?? [],
      metadata:    row.metadata    ?? {},
      dismissedAt: row.dismissed_at,
      completedAt: row.completed_at,
      expiresAt:   row.expires_at,
      createdAt:   row.created_at,
    }));
  } catch {
    return [];
  }
}
