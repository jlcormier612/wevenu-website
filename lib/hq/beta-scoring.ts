/**
 * Beta Command Center scoring model.
 *
 * All tunable thresholds for health status, trend, and risk signals live
 * here — not in SQL — specifically so they can be adjusted during beta
 * without a migration. See docs/wevenu-hq-architecture.md §2.6 for the
 * rationale and §"Risk Signals" for the leading-indicator philosophy: these
 * signals are deliberately weighted toward things that predict trouble
 * (an invite sitting unopened, activation stalling) over things that just
 * confirm trouble already happened (score already low).
 *
 * Pure functions — no I/O. Called from lib/hq/beta-service.ts after mapping
 * get_beta_adoption_overview()'s raw rows.
 */
import type { BetaOverviewRow, BetaVenueSummary, HealthStatus, RiskSignal, Trend } from "@/lib/hq/beta-types";

const DAY_MS = 86_400_000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

// ---- Health Status ----------------------------------------------------------
//
//   Critical  — no engagement in 14+ days, OR score < 30
//   At Risk   — score < 50 AND no engagement in the last 7 days
//               (this is the same rule the original two-tier `risk_flag` used)
//   Healthy   — everything else
//
// Tune here: these are the two numbers ("14 days" / "30 points") most likely
// to need adjusting once real beta data comes in.
const CRITICAL_INACTIVITY_DAYS = 14;
const CRITICAL_SCORE_FLOOR = 30;
const AT_RISK_INACTIVITY_DAYS = 7;
const AT_RISK_SCORE_CEILING = 50;

export function computeHealthStatus(row: BetaOverviewRow): HealthStatus {
  const inactiveDays = daysSince(row.last_engagement_at);
  const neverEngaged = inactiveDays === null;

  if (row.score < CRITICAL_SCORE_FLOOR || neverEngaged || (inactiveDays !== null && inactiveDays >= CRITICAL_INACTIVITY_DAYS)) {
    return "critical";
  }
  if (row.score < AT_RISK_SCORE_CEILING && inactiveDays !== null && inactiveDays >= AT_RISK_INACTIVITY_DAYS) {
    return "at_risk";
  }
  return "healthy";
}

// ---- Trend -------------------------------------------------------------------
//
// Compares today's score to the score ~7 days ago (venue_activation_scores.
// score_7d_ago, populated by compute_venue_activation_score() from the daily
// snapshot table). "unknown" until a venue has 7+ days of history.
const TREND_IMPROVING_DELTA = 5;
const TREND_DECLINING_DELTA = -5;

export function computeTrend(row: BetaOverviewRow): Trend {
  if (row.score_7d_ago === null) return "unknown";
  const delta = row.score - row.score_7d_ago;
  if (delta >= TREND_IMPROVING_DELTA) return "improving";
  if (delta <= TREND_DECLINING_DELTA) return "declining";
  return "flat";
}

// ---- Adoption percentages ----------------------------------------------------
//
// Team + Couple reuse the activation model's own dimension weighting
// (dimension_scores.team is out of 15 pts, couple_engagement out of 30 —
// see docs/adoption-architecture.md §1) so these numbers stay consistent
// with the score shown everywhere else. Vendor adoption has no equivalent
// weighted dimension in the activation model (vendor engagement only
// touches the score indirectly, via first_vendor_assigned_at), so it's a
// simple claimed/invited ratio — a separate, simpler heuristic, not a
// fragment of the 100-pt score.

export function computeTeamAdoptionPct(row: BetaOverviewRow): number {
  const raw = row.dimension_scores?.team;
  if (raw == null) return 0;
  return Math.round((raw / 15) * 100);
}

export function computeCoupleAdoptionPct(row: BetaOverviewRow): number {
  const raw = row.dimension_scores?.couple_engagement;
  if (raw == null) return 0;
  return Math.round((raw / 30) * 100);
}

export function computeVendorAdoptionPct(row: BetaOverviewRow): number {
  if (row.vendors_invited === 0) return 0;
  return Math.round((row.vendors_claimed / row.vendors_invited) * 100);
}

// ---- Risk Signals (leading indicators) ---------------------------------------
//
// Each threshold below is a judgment call to be tuned during beta — they're
// named constants specifically so that tuning is a one-line diff, not an
// archaeology exercise.
const PORTAL_INVITE_STALE_DAYS = 3;
const VENDOR_INVITE_STALE_DAYS = 7;

export function computeRiskSignals(row: BetaOverviewRow): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const inviteSentDays = daysSince(row.first_portal_invite_sent_at);
  if (row.first_portal_invite_sent_at && !row.first_portal_open_at && inviteSentDays !== null && inviteSentDays >= PORTAL_INVITE_STALE_DAYS) {
    signals.push({ code: "portal_invite_no_open", label: `Portal invite sent ${inviteSentDays}d ago, not opened` });
  }

  const vendorInviteDays = daysSince(row.first_vendor_invited_at);
  if (row.vendors_invited > 0 && row.vendors_claimed === 0 && vendorInviteDays !== null && vendorInviteDays >= VENDOR_INVITE_STALE_DAYS) {
    signals.push({ code: "vendor_invite_pending", label: `Vendor invite pending ${vendorInviteDays}d, none accepted` });
  }

  if (row.total_clients > 0 && !row.first_portal_open_at) {
    signals.push({ code: "imported_no_engagement", label: `${row.total_clients} couple${row.total_clients === 1 ? "" : "s"} imported, no portal activity` });
  }

  if (row.activation_stalled_3d) {
    signals.push({ code: "activation_stalled", label: "Activation score unchanged for 3+ days" });
  }

  // Only signal a decline if there was meaningful prior activity — avoids
  // flagging brand-new venues where both windows are near-zero.
  if (row.team_events_prior_14d >= 3 && row.team_events_recent_14d < row.team_events_prior_14d) {
    signals.push({ code: "team_participation_declining", label: "Team engagement declining vs. prior 2 weeks" });
  }

  const lastActivityDays = daysSince(row.last_engagement_at);
  if (lastActivityDays === null || lastActivityDays >= AT_RISK_INACTIVITY_DAYS) {
    signals.push({ code: "no_recent_activity", label: lastActivityDays === null ? "No engagement recorded yet" : `No activity in ${lastActivityDays}d` });
  }

  return signals;
}

// ---- Row -> Summary ------------------------------------------------------

export function summarizeVenue(row: BetaOverviewRow): BetaVenueSummary {
  return {
    venueId: row.venue_id,
    venueName: row.venue_name,
    venueCreatedAt: row.venue_created_at,
    score: row.score,
    previousScore: row.previous_score,
    score7dAgo: row.score_7d_ago,
    phaseLabel: row.phase_label,
    gaps: row.gaps ?? [],
    dimensionScores: row.dimension_scores ?? {},
    lastEngagementAt: row.last_engagement_at,
    lastLoginAt: row.last_login_at,
    lastContactedAt: row.last_contacted_at,
    nextContactAt: row.next_contact_at,
    teamInvited: row.team_invited,
    teamAccepted: row.team_accepted,
    teamActive: row.team_active,
    vendorsInvited: row.vendors_invited,
    vendorsClaimed: row.vendors_claimed,
    portalsCreated: row.portals_created,
    lastPortalAccess: row.last_portal_access,
    totalClients: row.total_clients,
    healthStatus: computeHealthStatus(row),
    trend: computeTrend(row),
    riskSignals: computeRiskSignals(row),
    teamAdoptionPct: computeTeamAdoptionPct(row),
    coupleAdoptionPct: computeCoupleAdoptionPct(row),
    vendorAdoptionPct: computeVendorAdoptionPct(row),
  };
}
