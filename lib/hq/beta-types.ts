/**
 * Beta Command Center types. The "Row" shape mirrors
 * get_beta_adoption_overview()'s raw jsonb columns (snake_case, as returned
 * by Postgres); everything else is computed in lib/hq/beta-scoring.ts.
 */

export type HealthStatus = "healthy" | "at_risk" | "critical";
export type Trend = "improving" | "flat" | "declining" | "unknown";

export type RiskSignalCode =
  | "portal_invite_no_open"
  | "vendor_invite_pending"
  | "imported_no_engagement"
  | "activation_stalled"
  | "team_participation_declining"
  | "no_recent_activity";

export type RiskSignal = {
  code: RiskSignalCode;
  label: string;
};

/** Raw row shape returned by get_beta_adoption_overview(). */
export type BetaOverviewRow = {
  venue_id: string;
  venue_name: string;
  venue_created_at: string;
  score: number;
  previous_score: number | null;
  score_7d_ago: number | null;
  phase_label: string;
  gaps: { action: string; pts: number; href: string }[];
  dimension_scores: Record<string, number> | null;
  risk_flag: boolean;
  team_invited: number;
  team_accepted: number;
  team_active: number;
  team_events_recent_14d: number;
  team_events_prior_14d: number;
  vendors_invited: number;
  vendors_claimed: number;
  first_vendor_invited_at: string | null;
  portals_created: number;
  last_portal_access: string | null;
  first_portal_invite_sent_at: string | null;
  first_portal_open_at: string | null;
  total_clients: number;
  activation_stalled_3d: boolean;
  last_engagement_at: string | null;
  last_login_at: string | null;
  last_contacted_at: string | null;
  next_contact_at: string | null;
};

/** BetaOverviewRow + everything lib/hq/beta-scoring.ts derives from it. */
export type BetaVenueSummary = {
  venueId: string;
  venueName: string;
  venueCreatedAt: string;
  score: number;
  previousScore: number | null;
  score7dAgo: number | null;
  phaseLabel: string;
  gaps: { action: string; pts: number; href: string }[];
  dimensionScores: Record<string, number>;
  lastEngagementAt: string | null;
  lastLoginAt: string | null;
  lastContactedAt: string | null;
  nextContactAt: string | null;
  teamInvited: number;
  teamAccepted: number;
  teamActive: number;
  vendorsInvited: number;
  vendorsClaimed: number;
  portalsCreated: number;
  lastPortalAccess: string | null;
  totalClients: number;
  // computed
  healthStatus: HealthStatus;
  trend: Trend;
  riskSignals: RiskSignal[];
  teamAdoptionPct: number;
  coupleAdoptionPct: number;
  vendorAdoptionPct: number;
};

export type BetaOverviewSummary = {
  venues: BetaVenueSummary[];
  kpis: {
    totalVenues: number;
    healthy: number;
    atRisk: number;
    critical: number;
    avgActivationPct: number;
    avgTeamAdoptionPct: number;
    avgVendorAdoptionPct: number;
    avgCoupleAdoptionPct: number;
  };
};
