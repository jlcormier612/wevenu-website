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

/**
 * Guided Setup, Hospitality Success Platform §1.1 — the full checklist
 * (every item the Activation Engine tracks, completed or not), not just
 * the top-3 incomplete ones `gaps` exposes. This is what the Getting
 * Started card renders from now — one computation, not two.
 */
export type ActivationChecklistItem = {
  key: string;
  label: string;
  points: number;
  href: string;
  completed: boolean;
};

export type ActivationScore = {
  score: number;
  previousScore: number | null;
  phase: ActivationPhase;
  phaseLabel: string;
  dimensionScores: Record<string, number>;
  gaps: ActivationGap[];
  checklist: ActivationChecklistItem[];
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
