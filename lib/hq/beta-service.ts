/**
 * Beta Command Center — cohort overview. Server-only, HQ-admin-only
 * (enforced inside get_beta_adoption_overview() itself, not just at the
 * app layer — see the Sprint 108.5 migration for why).
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { summarizeVenue } from "@/lib/hq/beta-scoring";
import type { BetaOverviewRow, BetaOverviewSummary } from "@/lib/hq/beta-types";

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export async function getBetaOverview(): Promise<BetaOverviewSummary | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_beta_adoption_overview");
  if (error || !data) return null;

  const rows = data as BetaOverviewRow[];
  const venues = rows.map(summarizeVenue);

  const healthy = venues.filter((v) => v.healthStatus === "healthy").length;
  const atRisk = venues.filter((v) => v.healthStatus === "at_risk").length;
  const critical = venues.filter((v) => v.healthStatus === "critical").length;

  return {
    venues,
    kpis: {
      totalVenues: venues.length,
      healthy,
      atRisk,
      critical,
      avgActivationPct: average(venues.map((v) => v.score)),
      avgTeamAdoptionPct: average(venues.map((v) => v.teamAdoptionPct)),
      avgVendorAdoptionPct: average(venues.map((v) => v.vendorAdoptionPct)),
      avgCoupleAdoptionPct: average(venues.map((v) => v.coupleAdoptionPct)),
    },
  };
}
