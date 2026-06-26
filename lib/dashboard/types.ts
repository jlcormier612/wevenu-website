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

export type DashboardData = {
  venueName: string;
  todayIso: string;
  needsAttention: AttentionLead[];
  followupsDue: Lead[];
  upcomingTours: Lead[];
  pipelineStages: PipelineStage[];
  totalLeads: number;
  newLeadCount: number;
  openTasks: TaskItem[];
  openTaskCount: number;
  recentActivity: ActivityItem[];
};
