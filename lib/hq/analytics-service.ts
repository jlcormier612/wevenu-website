/**
 * Wevenu HQ — Analytics. Server-only, HQ-admin-only.
 *
 * Deliberately derives everything from the same BetaVenueSummary rows the
 * Beta Command Center already fetches (getBetaOverview()) rather than new
 * queries — every figure here (active venues, distribution, adoption rates)
 * is a reduction over data already loaded for the cohort, so this module
 * adds zero new SQL.
 */
import { getBetaOverview } from "@/lib/hq/beta-service";
import type { BetaVenueSummary } from "@/lib/hq/beta-types";

export type HqAnalytics = {
  totalVenues: number;
  activeToday: number;
  activeThisWeek: number;
  phaseDistribution: { phaseLabel: string; count: number }[];
  portalAdoptionPct: number;
  vendorAdoptionPct: number;
  teamAdoptionPct: number;
  importAdoptionPct: number;
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function pctWith(venues: BetaVenueSummary[], pred: (v: BetaVenueSummary) => boolean): number {
  if (venues.length === 0) return 0;
  return Math.round((venues.filter(pred).length / venues.length) * 100);
}

export async function getHqAnalytics(): Promise<HqAnalytics | null> {
  const overview = await getBetaOverview();
  if (!overview) return null;
  const { venues } = overview;

  const activeToday = venues.filter((v) => {
    const d = daysSince(v.lastEngagementAt);
    return d !== null && d < 1;
  }).length;

  const activeThisWeek = venues.filter((v) => {
    const d = daysSince(v.lastEngagementAt);
    return d !== null && d < 7;
  }).length;

  const distributionMap = new Map<string, number>();
  for (const v of venues) {
    distributionMap.set(v.phaseLabel, (distributionMap.get(v.phaseLabel) ?? 0) + 1);
  }

  return {
    totalVenues: venues.length,
    activeToday,
    activeThisWeek,
    phaseDistribution: Array.from(distributionMap.entries()).map(([phaseLabel, count]) => ({ phaseLabel, count })),
    portalAdoptionPct: pctWith(venues, (v) => v.portalsCreated > 0),
    vendorAdoptionPct: pctWith(venues, (v) => v.vendorsInvited > 0),
    teamAdoptionPct: pctWith(venues, (v) => v.teamInvited > 0),
    importAdoptionPct: pctWith(venues, (v) => v.totalClients > 0),
  };
}
