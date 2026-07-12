/**
 * Event Readiness — Phase 1: Platform Integration.
 *
 * Seating (guest_seat_assignments) is deliberately Client-Owned with zero
 * RLS policies for any session other than the couple's own portal token
 * (Seating Experience — Phase 1 migration, 20260828000000) — a venue
 * session cannot select it directly, by design. Rather than adding a new
 * venue-scoped RLS policy or RPC (which would need a real product decision,
 * not just an engineering one — see docs/floor-plan-seating-architecture.md
 * and docs/wedding-workspace-architecture.md §17), this reuses the couple's
 * own get_seating_data(p_token) RPC server-side, via the same portal
 * session token the Booking Workspace already resolves for its "View
 * Client Portal" links. It invents no new seating logic — it just reads
 * the same stats block the couple's own Seating tab already computes.
 */
import { createClient } from "@/integrations/supabase/server";

export type SeatingReadinessSummary = {
  floorPlanShared: boolean;
  totalAttending: number;
  totalAssigned: number;
  needsReassignmentCount: number;
};

export async function getSeatingReadinessSummary(portalToken: string | null): Promise<SeatingReadinessSummary | null> {
  if (!portalToken) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_seating_data", { p_token: portalToken });
  if (error || !data || data.error) return null;

  return {
    floorPlanShared: !!data.floorPlan,
    totalAttending: data.stats?.totalAttending ?? 0,
    totalAssigned: data.stats?.totalAssigned ?? 0,
    needsReassignmentCount: (data.needsReassignment ?? []).length,
  };
}
