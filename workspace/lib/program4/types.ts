/**
 * Program 4 — Team Operations types.
 * Team members, permissions, commission plans & ledger.
 */

export type TeamRole =
  | "owner"
  | "administrator"
  | "sales"
  | "customer_success"
  | "implementation"
  | "support"
  | "finance"
  | "marketing"
  | "viewer";

export type TeamDepartment =
  | "leadership"
  | "sales"
  | "customer_success"
  | "implementation"
  | "support"
  | "finance"
  | "marketing";

export type TeamAvailability = "available" | "busy" | "ooo" | "part_time";

export type Permission =
  | "view_business_dashboard"
  | "view_today"
  | "view_relationships"
  | "edit_relationships"
  | "view_walkthroughs"
  | "manage_walkthroughs"
  | "view_onboarding"
  | "manage_onboarding"
  | "view_tasks"
  | "manage_tasks"
  | "view_workflows"
  | "manage_workflows"
  | "view_communications"
  | "manage_communications"
  | "view_founding"
  | "manage_welcome_back"
  | "manage_product_sync"
  | "view_reports"
  | "view_finance"
  | "view_commissions"
  | "manage_commissions"
  | "view_team"
  | "manage_team"
  | "manage_settings";

export type TeamGoal = {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: "count" | "currency_cents" | "percent";
  period: "month" | "quarter" | "year";
};

export type CommissionEventType =
  | "walkthrough_booked"
  | "subscription_sold"
  | "white_glove_sold"
  | "renewal"
  | "referral"
  | "expansion";

export type CommissionRate =
  | { mode: "percent"; /** basis points of event amount, e.g. 1000 = 10% */ bps: number }
  | { mode: "flat"; /** fixed cents */ cents: number };

export type CommissionPlan = {
  id: string;
  name: string;
  description: string;
  rates: Partial<Record<CommissionEventType, CommissionRate>>;
  active: boolean;
};

export type CommissionLedgerStatus = "pending" | "approved" | "paid" | "void";

export type CommissionLedgerEntry = {
  id: string;
  teamMemberId: string;
  relationshipId: string;
  eventType: CommissionEventType;
  /** Source event id (timeline / status move) for idempotency. */
  sourceEventId: string;
  /** Amount the rate applied to (e.g. first-month MRR). */
  basisCents: number;
  commissionCents: number;
  planId: string;
  occurredAt: string;
  periodKey: string;
  status: CommissionLedgerStatus;
  note?: string;
};

export type TeamMemberProfile = {
  id: string;
  name: string;
  email: string;
  initials: string;
  /** RBAC role. */
  role: TeamRole;
  /** Display job title. */
  title: string;
  department: TeamDepartment;
  commissionPlanId: string | null;
  goals: TeamGoal[];
  availability: TeamAvailability;
  /** Future: sales territory — stub OK. */
  territory: string | null;
  active: boolean;
  joinedAt: string;
};

/** Project 8 — pending / accepted team invites. */
export type TeamInviteStatus = "pending" | "accepted" | "revoked";

export type TeamInvite = {
  id: string;
  token: string;
  email: string;
  name: string;
  role: TeamRole;
  /** Existing member id when re-inviting a seed roster row; else set on accept. */
  memberId: string | null;
  invitedById: string;
  status: TeamInviteStatus;
  createdAt: string;
  acceptedAt?: string;
};

/** Project 8 — hashed credentials (no plaintext passwords). */
export type TeamCredential = {
  memberId: string;
  email: string;
  /** `scrypt:<saltHex>:<hashHex>` */
  passwordHash: string;
  acceptedAt: string;
  updatedAt: string;
};

/** Project 8 — opaque session records. */
export type WorkspaceSession = {
  id: string;
  memberId: string;
  createdAt: string;
  expiresAt: string;
};
