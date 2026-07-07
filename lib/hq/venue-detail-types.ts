import type { HealthStatus, RiskSignal, Trend } from "@/lib/hq/beta-types";

export type HqVenueSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  createdAt: string;
};

export type HqActivationDetail = {
  score: number;
  previousScore: number | null;
  score7dAgo: number | null;
  phaseLabel: string;
  dimensionScores: Record<string, number>;
  gaps: { action: string; pts: number; href: string }[];
  healthStatus: HealthStatus;
  trend: Trend;
  riskSignals: RiskSignal[];
};

export type HqTeamMember = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isOwner: boolean;
  isActive: boolean;
  invitedAt: string | null;
  acceptedAt: string | null;
  lastActiveAt: string | null;
};

export type HqVendorInvite = {
  id: string;
  vendorName: string | null;
  email: string;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
};

export type HqCouple = {
  id: string;
  name: string;
  eventDate: string | null;
  status: string;
  createdAt: string;
  portalLastAccess: string | null;
};

export type HqTimelineEntry = {
  kind: "event" | "milestone";
  occurredAt: string;
  label: string;
  actorType: string | null;
};

export type HqNote = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type HqTask = {
  id: string;
  assignedName: string | null;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type HqCrmState = {
  lastContactedAt: string | null;
  nextContactAt: string | null;
};

export type HqVenueDetail = {
  venue: HqVenueSummary;
  activation: HqActivationDetail;
  team: HqTeamMember[];
  vendors: HqVendorInvite[];
  couples: HqCouple[];
  timeline: HqTimelineEntry[];
  notes: HqNote[];
  tasks: HqTask[];
  crmState: HqCrmState;
};
