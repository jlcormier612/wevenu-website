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

/** Minimal client shape needed by the dashboard widgets. */
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
  ctaLabel?: string;
  ctaHref?: string;
};

export type OnboardingStatus = {
  /** Whether to render the Getting Started card at all. */
  show: boolean;
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
  /** True when every step is done — the card auto-hides. */
  allComplete: boolean;
};

export type DashboardData = {
  venueName: string;
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
  // ---- booked clients ----
  upcomingClientEvents: DashboardClient[];
  recentBookings: DashboardClient[];
  upcomingKeyDates: DashboardKeyDate[];
  totalClients: number;
};
