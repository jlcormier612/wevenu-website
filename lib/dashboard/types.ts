/**
 * Dashboard domain types (Sprint 7 — Today Dashboard).
 * Pure types — no framework or database imports.
 */
import type { Lead } from "@/lib/leads/types";

/** Lead with a computed "why it needs attention" reason string. */
export type AttentionLead = Lead & {
  reason: string;
};

/** Open task enriched with the owning lead's display name. */
export type TaskItem = {
  id: string;
  leadId: string;
  title: string;
  dueDate: string | null;
  leadName: string;
};

/** Activity enriched with the owning lead's display name. */
export type ActivityItem = {
  id: string;
  leadId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  leadName: string;
};

/** Per-status count for the pipeline snapshot. */
export type PipelineStage = {
  status: string;
  label: string;
  count: number;
};

// ---- Client dashboard types ------------------------------------------------

/** Minimal client shape needed by the recent-bookings widget. */
export type DashboardClient = {
  id: string;
  firstName: string;
  lastName: string;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
  status: string;
  createdAt: string;
};

/**
 * Upcoming event from the events table (canonical source for event dates/times).
 * Replaces the previous client-based approach; events are now the source of truth.
 */
export type DashboardEvent = {
  id: string;
  name: string;
  eventDate: string;
  startTime: string | null;
  status: string;
  guestCount: number | null;
  clientId: string | null;
  clientName: string | null;
};

/** Key date enriched with the owning client's display name. */
export type DashboardKeyDate = {
  id: string;
  clientId: string;
  label: string;
  date: string;
  clientName: string;
};

/** A single step in the Getting Started checklist. */
export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  timeEstimate?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type OnboardingStatus = {
  /** Whether to render the Getting Started card at all. */
  show: boolean;
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
  /** True when every step is done — graduation card replaces the checklist. */
  allComplete: boolean;
  /** Luv's priority coaching message — the single most impactful next step. */
  luvNudge: string | null;
  /** Live operating summary shown in the graduation card. */
  summary: {
    weeklyInquiries: number;
    upcomingTourCount: number;
    openTaskCount: number;
  } | null;
};

/** Payment due item for the dashboard. */
export type DashboardPayment = {
  id: string;        // line item id
  scheduleId: string;
  label: string;
  amount: number;
  dueDate: string;
  isOverdue: boolean;
  clientName: string | null;
};

export type DashboardData = {
  venueName: string;
  ownerFirstName: string | null;
  todayIso: string;
  onboarding: OnboardingStatus;
  // ---- pipeline (leads) ----
  needsAttention: AttentionLead[];
  followupsDue: Lead[];
  upcomingTours: Lead[];
  pipelineStages: PipelineStage[];
  totalLeads: number;
  newLeadCount: number;
  openTasks: TaskItem[];
  openTaskCount: number;
  recentActivity: ActivityItem[];
  // ---- payments ----
  overduePayments: DashboardPayment[];
  upcomingPayments: DashboardPayment[];
  // ---- booked clients + events ----
  /** Upcoming events from the events table (canonical source). */
  upcomingEvents: DashboardEvent[];
  /** Recently booked clients (by booking date, from the clients table). */
  recentBookings: DashboardClient[];
  upcomingKeyDates: DashboardKeyDate[];
  totalClients: number;
  // ---- Luv observations (Phase 1: data pattern matching, no AI) ----
  luvObservations: import("@/lib/luv/types").LuvObservation[];
  // ---- Luv trend intelligence (Sprint 93: period-over-period deltas) ----
  trendObservations: import("@/lib/luv/types").LuvObservation[];
  // ---- Luv Story Mode (Sprint 95: named narrative archetype) ----
  storyObservation: import("@/lib/luv/types").LuvObservation | null;
  // ---- Luv Memory observations (Sprint 97: longitudinal venue intelligence) ----
  memoryObservations: import("@/lib/luv/types").LuvObservation[];
  // ---- Luv Insight observations (Sprint 98: pattern detection + confidence scoring) ----
  insightObservations: import("@/lib/luv/types").LuvObservation[];
  // ---- Venue Health Score (Sprint 99: composite operational score + explanation) ----
  healthScore: import("@/lib/luv/health-types").VenueHealthScore | null;
  // ---- Luv Recommendations (Sprint 100: advice + navigation, no AI generation yet) ----
  recommendations: import("@/lib/luv/recommendation-types").VenueRecommendation[];
  // ---- Luv Action Outcomes (Sprint 102: follow-through + outcome tracking) ----
  actionObservations: import("@/lib/luv/types").LuvObservation[];
  // ---- Luv Pending Actions (Sprint 103: what Luv is currently watching) ----
  pendingActionObservations: import("@/lib/luv/types").LuvObservation[];
  // ---- Luv Performance Intelligence (Sprint 104: what has worked over time) ----
  performanceObservations: import("@/lib/luv/types").LuvObservation[];
  // ---- Momentum segments (Sprint 37) ----
  momentumSegments: {
    heatingUp: { leadId: string; name: string; reason: string }[];
    coolingOff: { leadId: string; name: string; reason: string }[];
  };
  // ---- Activation Engine (Sprint 108) ----
  activationScore: import("@/lib/activation/types").ActivationScore | null;
  nextPendingMilestone: import("@/lib/activation/types").VenueMilestone | null;
  showDigestCallout: boolean;
};
