import { createClient } from "@/integrations/supabase/server";
import type { RawHealthRow, VenueHealthScore } from "./health-types";

export async function getVenueHealthScore(): Promise<VenueHealthScore | null> {
  try {
    const supabase = await createClient();
    await supabase.rpc("compute_venue_health_score");
    const { data, error } = await supabase.rpc("get_venue_health_score");
    if (error || !data) return null;
    const rows = data as RawHealthRow[];
    const row  = rows[0];
    if (!row) return null;
    return {
      score:      row.score,
      tier:       row.tier,
      dimensions: row.dimensions,
      strengths:  row.strengths  ?? [],
      gaps:       row.gaps       ?? [],
      computedAt: row.computed_at,
    };
  } catch {
    return null;
  }
}
