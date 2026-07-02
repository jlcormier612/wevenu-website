import { createClient } from "@/integrations/supabase/server";
import type { VenueAnalytics, HealthScores } from "./types";

export async function getVenueAnalytics(): Promise<VenueAnalytics | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_analytics");
  if (error || !data || (data as { error?: string }).error) return null;
  return data as VenueAnalytics;
}

export async function getClientHealthScores(): Promise<HealthScores | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_client_health_scores");
  if (error || !data || (data as { error?: string }).error) return null;
  return data as HealthScores;
}
