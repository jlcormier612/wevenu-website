import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { generateRollUp, buildPromptData } from "@/lib/luv/roll-up-service";
import type { VenueAnalytics, HealthScores } from "@/lib/analytics/types";
import type { LuvRollUp } from "@/lib/luv/roll-up-types";

// GET — return recent roll-ups for this venue (latest first, up to 5)
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_luv_rollups", { p_limit: 5 });
  if (error) return NextResponse.json({ rollups: [] });
  const d = data as { rollups?: LuvRollUp[] } | null;
  return NextResponse.json({ rollups: d?.rollups ?? [] });
}

// POST — generate a new roll-up and persist it
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "luv_not_configured", message: "Luv isn't configured yet." },
      { status: 503 },
    );
  }

  const supabase = await createClient();

  // Fetch analytics + health data in parallel
  const [analyticsResult, healthResult] = await Promise.all([
    supabase.rpc("get_venue_analytics"),
    supabase.rpc("get_client_health_scores"),
  ]);

  const analytics = analyticsResult.data as VenueAnalytics | null;
  const health    = healthResult.data as HealthScores | null;

  if (!analytics || !health || (analytics as { error?: string }).error) {
    return NextResponse.json({ error: "no_data", message: "No analytics data available yet." }, { status: 422 });
  }

  const observations = await generateRollUp(analytics, health, apiKey);
  if (!observations) {
    return NextResponse.json({ error: "generation_failed", message: "Luv had trouble generating a roll-up. Try again." }, { status: 500 });
  }

  const period = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const metricsSnapshot = {
    period,
    promptData: buildPromptData(analytics, health, period),
    analytics,
    health,
  };

  const { data: saved, error: saveErr } = await supabase.rpc("save_luv_rollup", {
    p_metrics_snapshot: metricsSnapshot,
    p_observations:     observations,
    p_model_used:       "claude-sonnet-4-6",
  });

  if (saveErr || (saved as { error?: string })?.error) {
    return NextResponse.json({ error: "save_failed", message: "Generated but couldn't save." }, { status: 500 });
  }

  return NextResponse.json({
    ok:           true,
    id:           (saved as { id?: string })?.id,
    generatedAt:  new Date().toISOString(),
    observations,
    modelUsed:    "claude-sonnet-4-6",
  });
}
