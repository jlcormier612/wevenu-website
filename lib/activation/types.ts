export type ActivationPhase = "setup" | "connected" | "almost" | "full";

export type MilestoneId =
  | "first_couple_portal_open"
  | "first_vendor_accepted"
  | "first_contract_signed"
  | "first_payment_received"
  | "first_team_member_joined"
  | "activation_70"
  | "fully_connected";

export type ActivationGap = {
  label: string;
  points: number;
  href: string;
};

export type ActivationScore = {
  score: number;
  previousScore: number | null;
  phase: ActivationPhase;
  phaseLabel: string;
  dimensionScores: Record<string, number>;
  gaps: ActivationGap[];
  computedAt: string;
};

export type VenueMilestone = {
  venueId: string;
  milestoneId: MilestoneId;
  firedAt: string;
  shownAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type EngagementEventInput = {
  venueId: string;
  eventType: string;
  actorType: "venue_user" | "couple" | "vendor" | "team_member" | "hq_admin";
  actorId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};
