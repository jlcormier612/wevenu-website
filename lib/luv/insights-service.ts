import { createClient } from "@/integrations/supabase/server";
import type { LuvObservation } from "@/lib/luv/types";
import type { RawInsightRow } from "./insights-types";

const INSIGHT_LINKS: Record<string, string> = {
  seasonal_concentration: "/analytics",
  inquiry_pacing:         "/leads",
  momentum:               "/leads",
};

const INSIGHT_ACTION_LABELS: Record<string, string> = {
  seasonal_concentration: "View analytics →",
  inquiry_pacing:         "View pipeline →",
  momentum:               "View pipeline →",
};

export async function getVenueInsights(): Promise<RawInsightRow[] | null> {
  try {
    const supabase = await createClient();
    await supabase.rpc("compute_venue_insights");
    const { data, error } = await supabase.rpc("get_venue_insights");
    if (error || !data) return null;
    return data as RawInsightRow[];
  } catch {
    return null;
  }
}

export function computeInsightObservations(rows: RawInsightRow[]): LuvObservation[] {
  // Low-confidence insights are stored but never surfaced — Luv learns quietly.
  return rows
    .filter(r => r.confidence !== "low")
    .map(row => ({
      id:          `insight_${row.type}`,
      kind:        "inference" as const,
      priority:    row.confidence === "high" ? ("medium" as const) : ("low" as const),
      message:     row.title,
      detail:      row.body,
      link:        INSIGHT_LINKS[row.type]        ?? "/analytics",
      actionLabel: INSIGHT_ACTION_LABELS[row.type] ?? "View →",
    }));
}
