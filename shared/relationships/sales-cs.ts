/**
 * Sales vs Customer Success — two views of one Relationship record.
 * Never duplicate. Filter by subscription / customer status; stages are view fields.
 *
 * After Stripe subscribe: same Relationship ID appears on both boards —
 * Sales (Closed Won) and Customer Success (Onboarding / Implementation).
 * Closed Won alone does not enter CS; only successful subscribe does.
 */

import type {
  Relationship,
  RelationshipHealth,
  RelationshipStatus,
} from "./types";
import { isCustomerLifecycleStatus, normalizeLifecycleStatus } from "./status";

/** Pre-customer Sales pipeline (board columns). */
export type SalesStage =
  | "inquiry"
  | "personal_send"
  | "sequence_scheduled"
  | "responded"
  | "walkthrough_scheduled"
  | "proposal_sent"
  | "follow_up"
  | "closed_won"
  | "closed_lost";

/** Post-subscribe Customer Success lifecycle stages. */
export type CustomerSuccessStage =
  | "onboarding"
  | "implementation"
  | "live"
  | "check_in_sequence"
  | "healthy"
  | "expansion"
  | "renewal"
  | "renewed"
  | "needs_support";

/** Board that owns an auto-arrival highlight. */
export type AutoArrivalBoard = "sales" | "cs";

/**
 * Set when a relationship automatically enters a highlightable stage
 * (ingest / subscribe / inbound reply / feedback). Cleared when acknowledged.
 */
export type LastAutoArrival = {
  stage: string;
  at: string;
  board: AutoArrivalBoard;
};

/** Sales stages that highlight when entered automatically (not board drag). */
export const SALES_AUTO_ARRIVAL_STAGES: ReadonlySet<SalesStage> = new Set([
  "inquiry",
  "walkthrough_scheduled",
  "responded",
]);

/** CS stages that highlight when entered automatically (not board drag). */
export const CS_AUTO_ARRIVAL_STAGES: ReadonlySet<CustomerSuccessStage> = new Set([
  "onboarding",
  "implementation",
  "renewal",
  "renewed",
  "needs_support",
]);

/** CS card health badge (display). */
export type CustomerHealthBadge =
  | "healthy"
  | "needs_attention"
  | "at_risk"
  | "critical";

export const SALES_STAGE_COLUMNS: {
  stage: SalesStage;
  label: string;
  short: string;
}[] = [
  { stage: "inquiry", label: "Inquiry", short: "Inquiry" },
  { stage: "personal_send", label: "Personal Send", short: "Personal" },
  { stage: "sequence_scheduled", label: "Sequence Scheduled", short: "Sequence" },
  { stage: "responded", label: "Responded", short: "Responded" },
  { stage: "walkthrough_scheduled", label: "Walkthrough Scheduled", short: "Walkthrough" },
  { stage: "proposal_sent", label: "Proposal Sent", short: "Proposal" },
  { stage: "follow_up", label: "Follow-up", short: "Follow-up" },
  { stage: "closed_won", label: "Closed Won", short: "Won" },
  { stage: "closed_lost", label: "Closed Lost", short: "Lost" },
];

export const CS_STAGE_COLUMNS: {
  stage: CustomerSuccessStage;
  label: string;
  short: string;
}[] = [
  { stage: "onboarding", label: "Onboarding", short: "Onboarding" },
  { stage: "implementation", label: "Implementation", short: "Impl" },
  { stage: "live", label: "Live", short: "Live" },
  { stage: "check_in_sequence", label: "Check-in Sequence", short: "Check-in" },
  { stage: "healthy", label: "Healthy", short: "Healthy" },
  { stage: "expansion", label: "Expansion", short: "Expansion" },
  { stage: "renewal", label: "Renewal", short: "Renewal" },
  { stage: "renewed", label: "Renewed", short: "Renewed" },
  { stage: "needs_support", label: "Needs Support", short: "Support" },
];

export const SALES_STAGE_LABELS: Record<SalesStage, string> = Object.fromEntries(
  SALES_STAGE_COLUMNS.map((c) => [c.stage, c.label]),
) as Record<SalesStage, string>;

export const CS_STAGE_LABELS: Record<CustomerSuccessStage, string> =
  Object.fromEntries(CS_STAGE_COLUMNS.map((c) => [c.stage, c.label])) as Record<
    CustomerSuccessStage,
    string
  >;

export const HEALTH_BADGE_LABELS: Record<CustomerHealthBadge, string> = {
  healthy: "Healthy",
  needs_attention: "Needs Attention",
  at_risk: "At Risk",
  critical: "Critical",
};

/**
 * Attention flags on Customer Success — NOT pipeline stages.
 * Combined with `?stage=` via AND when both are set (`?flag=`).
 */
export type CustomerSuccessFlag =
  | "wb_pending"
  | "founder"
  | "payment_issue"
  | "at_risk"
  | "suspended"
  | "manual_billing";

export const CS_FLAG_FILTERS: {
  value: CustomerSuccessFlag;
  label: string;
}[] = [
  { value: "wb_pending", label: "Welcome Back · Needs review" },
  { value: "founder", label: "Founder" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "at_risk", label: "At Risk / Critical" },
  { value: "suspended", label: "Suspended" },
  { value: "manual_billing", label: "Manual billing" },
];

export const CS_FLAG_LABELS: Record<CustomerSuccessFlag, string> =
  Object.fromEntries(CS_FLAG_FILTERS.map((f) => [f.value, f.label])) as Record<
    CustomerSuccessFlag,
    string
  >;

const CS_FLAG_SET = new Set<string>(CS_FLAG_FILTERS.map((f) => f.value));

export function isCustomerSuccessFlag(
  value: string | undefined,
): value is CustomerSuccessFlag {
  return typeof value === "string" && CS_FLAG_SET.has(value);
}

/** Resolve `?flag=` or legacy `?wb=pending` → active CS flag (or null). */
export function resolveCustomerSuccessFlag(params: {
  flag?: string;
  wb?: string;
}): CustomerSuccessFlag | null {
  if (isCustomerSuccessFlag(params.flag)) return params.flag;
  if (params.wb === "pending") return "wb_pending";
  return null;
}

/** Whether a relationship matches an attention flag (stage filters applied separately). */
export function matchesCustomerSuccessFlag(
  relationship: {
    foundingMember?: boolean;
    welcomeBackRequested?: boolean;
    welcomeBackVerified?: string;
    paymentStatus?: string | null;
    dunning?: Relationship["dunning"];
    health: RelationshipHealth;
    healthScore?: number | null;
    status: RelationshipStatus;
    accessDisabled?: boolean;
  },
  flag: CustomerSuccessFlag,
): boolean {
  switch (flag) {
    case "wb_pending":
      return (
        !!relationship.welcomeBackRequested &&
        relationship.welcomeBackVerified === "pending"
      );
    case "founder":
      return !!relationship.foundingMember;
    case "payment_issue": {
      const payment = (relationship.paymentStatus ?? "").toLowerCase();
      const activeDunning = !!(
        relationship.dunning && !relationship.dunning.clearedAt
      );
      return (
        payment === "past_due" || payment === "failed" || activeDunning
      );
    }
    case "at_risk": {
      const badge = toCustomerHealthBadge(
        relationship.health,
        relationship.healthScore,
      );
      if (badge === "at_risk" || badge === "critical") return true;
      if (
        typeof relationship.healthScore === "number" &&
        relationship.healthScore < 40
      ) {
        return true;
      }
      return relationship.health === "at_risk";
    }
    case "suspended":
      return (
        relationship.status === "suspended" || !!relationship.accessDisabled
      );
    case "manual_billing":
      return (relationship.paymentStatus ?? "").toLowerCase() === "manual";
    default:
      return false;
  }
}

const SALES_STAGE_SET = new Set<string>(SALES_STAGE_COLUMNS.map((c) => c.stage));
const CS_STAGE_SET = new Set<string>(CS_STAGE_COLUMNS.map((c) => c.stage));

/** Legacy Sales stage slugs → current columns. */
const LEGACY_SALES_STAGE_MAP: Record<string, SalesStage> = {
  discovery_scheduled: "sequence_scheduled",
  venue_walkthrough: "walkthrough_scheduled",
  negotiation: "proposal_sent",
  awaiting_signature: "follow_up",
  won: "closed_won",
  lost: "closed_lost",
  nurture: "follow_up",
};

export function isSalesStage(value: string): value is SalesStage {
  return SALES_STAGE_SET.has(value);
}

export function isCustomerSuccessStage(value: string): value is CustomerSuccessStage {
  return CS_STAGE_SET.has(value);
}

export function isSalesAutoArrivalStage(stage: string): stage is SalesStage {
  return SALES_AUTO_ARRIVAL_STAGES.has(stage as SalesStage);
}

export function isCsAutoArrivalStage(stage: string): stage is CustomerSuccessStage {
  return CS_AUTO_ARRIVAL_STAGES.has(stage as CustomerSuccessStage);
}

/** Record an unacknowledged auto-arrival into a highlightable pipeline stage. */
export function markAutoArrival(
  relationship: Pick<Relationship, "lastAutoArrival">,
  stage: string,
  board: AutoArrivalBoard,
  at?: string,
): void {
  if (board === "sales" && !isSalesAutoArrivalStage(stage)) return;
  if (board === "cs" && !isCsAutoArrivalStage(stage)) return;
  relationship.lastAutoArrival = {
    stage,
    board,
    at: at ?? new Date().toISOString(),
  };
}

export function clearAutoArrival(
  relationship: Pick<Relationship, "lastAutoArrival">,
): void {
  if (relationship.lastAutoArrival) {
    relationship.lastAutoArrival = null;
  }
}

/** True when this relationship still has an unacked auto-arrival for the given stage. */
export function hasUnackedAutoArrival(
  relationship: Pick<Relationship, "lastAutoArrival">,
  stage: string,
  board: AutoArrivalBoard,
): boolean {
  const hit = relationship.lastAutoArrival;
  return Boolean(hit && hit.board === board && hit.stage === stage);
}

/** Count of relationships with unacked auto-arrival in this stage/board. */
export function countAutoArrivalsForStage(
  relationships: Array<Pick<Relationship, "lastAutoArrival">>,
  stage: string,
  board: AutoArrivalBoard,
): number {
  return relationships.filter((r) => hasUnackedAutoArrival(r, stage, board)).length;
}

/** Map stored / legacy salesStage to a current column slug. */
export function normalizeSalesStage(
  value: string | null | undefined,
): SalesStage | null {
  if (!value) return null;
  if (isSalesStage(value)) return value;
  return LEGACY_SALES_STAGE_MAP[value] ?? null;
}

/**
 * Map stored / legacy customerSuccessStage to a current column slug.
 * welcome → onboarding (implementation when White Glove)
 * training → live (implementation when White Glove still incomplete)
 * adoption → check_in_sequence
 */
export function normalizeCustomerSuccessStage(
  value: string | null | undefined,
  relationship?: Pick<Relationship, "onboardingType" | "status">,
): CustomerSuccessStage | null {
  if (!value) return null;
  if (isCustomerSuccessStage(value)) return value;

  const isWg = relationship?.onboardingType === "white_glove";
  const status = relationship?.status
    ? normalizeLifecycleStatus(relationship.status as RelationshipStatus)
    : null;
  const wgIncomplete =
    isWg &&
    (status === "subscribed" ||
      status === "onboarding" ||
      status === "white_glove_implementation");

  if (value === "welcome") {
    return isWg ? "implementation" : "onboarding";
  }
  if (value === "training") {
    return wgIncomplete ? "implementation" : "live";
  }
  if (value === "adoption") {
    return "check_in_sequence";
  }
  return null;
}

/** True when this relationship belongs on the Customer Success board. */
export function isInCustomerSuccessView(
  relationship: Pick<Relationship, "status" | "subscribedAt">,
): boolean {
  if (relationship.subscribedAt) return true;
  const status = normalizeLifecycleStatus(relationship.status);
  if (status === "former_customer") return true;
  return isCustomerLifecycleStatus(relationship.status);
}

/**
 * True when this relationship belongs on the Sales board.
 * Includes subscribed Closed Won / Closed Lost — dual-board with CS after subscribe.
 * Closed Won alone does not enter CS; only successful subscribe does.
 */
export function isInSalesView(
  _relationship?: Pick<Relationship, "status" | "subscribedAt">,
): boolean {
  return true;
}

/**
 * Happy-path rank for soft ingest promotion (mirrors promoteStatus).
 * closed_lost sits below inquiry so re-engagement can advance.
 */
const SALES_STAGE_RANK: Record<SalesStage, number> = {
  closed_lost: 5,
  inquiry: 10,
  personal_send: 20,
  sequence_scheduled: 30,
  responded: 40,
  walkthrough_scheduled: 50,
  proposal_sent: 60,
  follow_up: 70,
  closed_won: 80,
};

/** Map legacy lifecycle status → Sales board column (ingest / backfill). */
export function salesStageFromLifecycleStatus(
  status: RelationshipStatus | string | null | undefined,
): SalesStage {
  const normalized = normalizeLifecycleStatus(
    (status || "inquiry") as RelationshipStatus,
  );
  switch (normalized) {
    case "walkthrough_requested":
      // Soft walkthrough request (no booked datetime) → Sales Inquiry, not Personal Send.
      return "inquiry";
    case "walkthrough_scheduled":
    case "walkthrough_completed":
      return "walkthrough_scheduled";
    case "trial":
      return "proposal_sent";
    case "subscribed":
    case "onboarding":
    case "white_glove_implementation":
    case "active":
    case "reactivated":
    case "expansion":
    case "referral":
    case "renewal":
    case "support":
    case "at_risk":
    case "suspended":
      return "closed_won";
    default:
      return "inquiry";
  }
}

/**
 * Advance salesStage when next is further along. Soft ingest must not regress
 * (e.g. contact form must not pull a walkthrough card back to Inquiry).
 */
export function promoteSalesStage(
  current: SalesStage | string | null | undefined,
  next: SalesStage | string | null | undefined,
): SalesStage {
  const cur = normalizeSalesStage(current) ?? "inquiry";
  const nxt = normalizeSalesStage(next);
  if (!nxt) return cur;
  if (SALES_STAGE_RANK[nxt] >= SALES_STAGE_RANK[cur]) return nxt;
  return cur;
}

/**
 * Happy-path CS rank for soft anniversary / lifecycle promotion.
 * `needs_support` is excluded — pin/restore is handled separately.
 */
const CS_STAGE_RANK: Record<
  Exclude<CustomerSuccessStage, "needs_support">,
  number
> = {
  onboarding: 10,
  implementation: 20,
  live: 30,
  check_in_sequence: 40,
  healthy: 50,
  expansion: 60,
  renewal: 70,
  renewed: 80,
};

/**
 * Soft-advance CS stage (auto only). Never regresses, except annual cycle
 * `renewed → renewal` when `allowRenewedToRenewal` is set.
 * Does not move into/out of `needs_support` (use promote/restore helpers).
 */
export function promoteCustomerSuccessStage(
  current: CustomerSuccessStage | string | null | undefined,
  next: CustomerSuccessStage | string | null | undefined,
  opts?: { allowRenewedToRenewal?: boolean },
): CustomerSuccessStage {
  const curRaw = normalizeCustomerSuccessStage(current) ?? "onboarding";
  const nxtRaw = normalizeCustomerSuccessStage(next);
  if (!nxtRaw || nxtRaw === "needs_support") return curRaw;
  if (curRaw === "needs_support") return curRaw;

  if (
    opts?.allowRenewedToRenewal &&
    curRaw === "renewed" &&
    nxtRaw === "renewal"
  ) {
    return "renewal";
  }

  // Never auto-regress renewed → renewal without the annual-cycle flag.
  if (curRaw === "renewed" && nxtRaw === "renewal") return curRaw;

  const curRank = CS_STAGE_RANK[curRaw as Exclude<CustomerSuccessStage, "needs_support">];
  const nxtRank = CS_STAGE_RANK[nxtRaw as Exclude<CustomerSuccessStage, "needs_support">];
  if (curRank == null) return nxtRaw;
  if (nxtRank == null) return curRaw;
  if (nxtRank >= curRank) return nxtRaw;
  return curRaw;
}

/** Infer Sales stage from legacy lifecycle status when salesStage unset. */
export function deriveSalesStage(
  relationship: Pick<Relationship, "status" | "salesStage" | "subscribedAt">,
): SalesStage {
  const normalized = normalizeSalesStage(relationship.salesStage);
  if (normalized) return normalized;
  if (isInCustomerSuccessView(relationship)) return "closed_won";
  return salesStageFromLifecycleStatus(relationship.status);
}

/**
 * Infer CS stage without open-support pinning (used when saving
 * `customerSuccessStageBeforeSupport`).
 */
export function deriveCustomerSuccessStageBase(
  relationship: Pick<
    Relationship,
    "status" | "customerSuccessStage" | "onboardingType" | "health"
  >,
): CustomerSuccessStage {
  const fromStored = normalizeCustomerSuccessStage(
    relationship.customerSuccessStage,
    relationship,
  );
  if (fromStored && fromStored !== "needs_support") return fromStored;

  const status = normalizeLifecycleStatus(relationship.status as RelationshipStatus);
  switch (status) {
    case "subscribed":
      return relationship.onboardingType === "white_glove"
        ? "implementation"
        : "onboarding";
    case "onboarding":
      return "onboarding";
    case "white_glove_implementation":
      return "implementation";
    case "expansion":
      return "expansion";
    case "renewal":
      return "renewal";
    case "former_customer":
      return "renewed";
    case "active":
    case "reactivated":
    case "support":
    case "at_risk":
    case "suspended":
    case "referral":
      if (relationship.health === "excellent" || relationship.health === "good") {
        return status === "referral" ? "check_in_sequence" : "healthy";
      }
      return status === "referral" ? "check_in_sequence" : "live";
    default:
      return relationship.onboardingType === "white_glove"
        ? "implementation"
        : "onboarding";
  }
}

/**
 * True when this relationship should count toward the CS open-support badge
 * and appear under Needs Support (includes NPS / product feedback items).
 */
export function relationshipHasOpenSupport(
  relationship: Pick<
    Relationship,
    "status" | "supportOpenCount" | "openFeedbackItems"
  >,
): boolean {
  if ((relationship.supportOpenCount || 0) > 0) return true;
  if (normalizeLifecycleStatus(relationship.status) === "support") return true;
  return (relationship.openFeedbackItems ?? []).some((i) => i.status === "open");
}

/** Infer CS stage from legacy lifecycle status when customerSuccessStage unset. */
export function deriveCustomerSuccessStage(
  relationship: Pick<
    Relationship,
    | "status"
    | "customerSuccessStage"
    | "onboardingType"
    | "health"
    | "supportOpenCount"
    | "openFeedbackItems"
  >,
): CustomerSuccessStage {
  // Pin open-support relationships in Needs Support until resolved.
  if (relationshipHasOpenSupport(relationship)) return "needs_support";
  return deriveCustomerSuccessStageBase(relationship);
}

/**
 * Soft-promote into Needs Support, remembering the prior stage for restore.
 * No-op when already pinned / already at needs_support with a saved prior.
 */
export function promoteToNeedsSupport(
  relationship: Pick<
    Relationship,
    | "status"
    | "customerSuccessStage"
    | "customerSuccessStageBeforeSupport"
    | "onboardingType"
    | "health"
    | "supportOpenCount"
    | "lastAutoArrival"
  > & {
    customerSuccessStage?: CustomerSuccessStage;
    customerSuccessStageBeforeSupport?: CustomerSuccessStage | null;
    lastAutoArrival?: LastAutoArrival | null;
  },
): void {
  const current =
    normalizeCustomerSuccessStage(relationship.customerSuccessStage, relationship) ??
    deriveCustomerSuccessStageBase(relationship);

  if (current !== "needs_support") {
    if (!relationship.customerSuccessStageBeforeSupport) {
      relationship.customerSuccessStageBeforeSupport = current;
    }
    relationship.customerSuccessStage = "needs_support";
    markAutoArrival(relationship, "needs_support", "cs");
    return;
  }

  // Already needs_support — ensure we have a restore target.
  if (!relationship.customerSuccessStageBeforeSupport) {
    relationship.customerSuccessStageBeforeSupport =
      relationship.onboardingType === "white_glove" ? "implementation" : "live";
  }
}

/**
 * After all open support is cleared, restore the pre-support CS stage.
 */
export function restoreFromNeedsSupport(
  relationship: Pick<
    Relationship,
    | "status"
    | "customerSuccessStage"
    | "customerSuccessStageBeforeSupport"
    | "onboardingType"
    | "health"
    | "supportOpenCount"
  > & {
    customerSuccessStage?: CustomerSuccessStage;
    customerSuccessStageBeforeSupport?: CustomerSuccessStage | null;
  },
): void {
  if ((relationship.supportOpenCount || 0) > 0) return;

  const prior = relationship.customerSuccessStageBeforeSupport;
  const restored =
    prior && prior !== "needs_support"
      ? prior
      : relationship.onboardingType === "white_glove"
        ? "implementation"
        : "live";

  relationship.customerSuccessStage = restored;
  relationship.customerSuccessStageBeforeSupport = null;
}

/** Map health band + score → CS card badge. */
export function toCustomerHealthBadge(
  health: RelationshipHealth,
  healthScore?: number | null,
  opts?: { suspended?: boolean; accessDisabled?: boolean },
): CustomerHealthBadge {
  if (opts?.suspended || opts?.accessDisabled) return "critical";
  if (health === "at_risk") {
    if (typeof healthScore === "number" && healthScore < 25) return "critical";
    return "at_risk";
  }
  if (health === "needs_attention") return "needs_attention";
  return "healthy";
}

export type AdoptionCheckpoint = {
  id: string;
  label: string;
  done: boolean;
};

/** Adoption progress indicators for CS cards / record. */
export function computeAdoptionCheckpoints(
  relationship: {
    websitePublished?: boolean;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    paymentStatus?: string | null;
    activationCompletedAt?: string | null;
    productSync?: Relationship["productSync"];
  },
  extras?: {
    onboardingProgress?: number;
    websitePublished?: boolean;
    teamInvited?: boolean;
    firstEventCreated?: boolean;
    firstCoupleAdded?: boolean;
    automationEnabled?: boolean;
  },
): AdoptionCheckpoint[] {
  const sync = relationship.productSync;
  const steps = sync?.steps ?? [];
  const stepDone = (id: string) =>
    steps.find((s) => s.id === id)?.status === "completed";

  // Website Published checkpoint omitted until a real venue marketing
  // publish signal exists (field + health scoring unchanged).
  const stripeConnected = Boolean(
    relationship.stripeSubscriptionId ||
      relationship.stripeCustomerId ||
      stepDone("subscription") ||
      relationship.paymentStatus === "paid" ||
      relationship.paymentStatus === "manual",
  );
  const onboardingPct = extras?.onboardingProgress ?? 0;
  const teamInvited = Boolean(
    extras?.teamInvited ??
      (stepDone("owner_account") || Boolean(relationship.activationCompletedAt)),
  );

  return [
    {
      id: "onboarding",
      label: `Onboarding ${onboardingPct}%`,
      done: onboardingPct >= 100,
    },
    {
      id: "team",
      label: "Team Invited",
      done: teamInvited,
    },
    {
      id: "stripe",
      label: "Stripe Connected",
      done: stripeConnected,
    },
    {
      id: "first_event",
      label: "First Event Created",
      done: Boolean(extras?.firstEventCreated ?? sync?.launchedAt),
    },
    {
      id: "first_couple",
      label: "First Couple Added",
      done: Boolean(extras?.firstCoupleAdded),
    },
    {
      id: "automation",
      label: "Automation Enabled",
      done: Boolean(extras?.automationEnabled),
    },
  ];
}

export type RiskReason =
  | "No recent login"
  | "Website unpublished"
  | "No active events"
  | "Incomplete onboarding"
  | "Overdue invoice"
  | "Open support issue"
  | "Declining activity"
  | "Account suspended"
  | "Payment past due"
  | "Active payment dunning";

export type RiskTone = "green" | "yellow" | "red";

export function computeRiskSection(
  relationship: {
    status: RelationshipStatus;
    health: RelationshipHealth;
    healthScore?: number | null;
    accessDisabled?: boolean;
    paymentStatus?: string | null;
    dunning?: Relationship["dunning"];
    lastLoginAt?: string | null;
    activationCompletedAt?: string | null;
    websitePublished?: boolean;
    supportOpenCount?: number;
    productSync?: Relationship["productSync"];
  },
  opts?: {
    onboardingProgress?: number;
    websitePublished?: boolean;
    daysSinceActivity?: number | null;
    healthFactors?: string[];
    overdueInvoice?: boolean;
  },
): { tone: RiskTone; reasons: string[] } {
  const reasons: string[] = [];
  const status = normalizeLifecycleStatus(relationship.status);
  const onboardingProgress = opts?.onboardingProgress ?? 0;
  const daysSince = opts?.daysSinceActivity ?? null;

  if (status === "suspended" || relationship.accessDisabled) {
    reasons.push("Account suspended");
  }
  if (
    relationship.paymentStatus === "past_due" ||
    relationship.paymentStatus === "failed"
  ) {
    reasons.push("Payment past due");
  }
  if (relationship.dunning && !relationship.dunning.clearedAt) {
    reasons.push("Active payment dunning");
  }
  if (relationship.lastLoginAt == null && relationship.activationCompletedAt) {
    reasons.push("No recent login");
  } else if (daysSince != null && daysSince > 21) {
    reasons.push("No recent login");
  }
  // "Website unpublished" omitted until a real venue marketing publish
  // signal exists (health scoring still uses websitePublished).
  if (!relationship.productSync?.launchedAt && status === "active") {
    reasons.push("No active events");
  }
  if (
    onboardingProgress < 100 &&
    (status === "onboarding" ||
      status === "white_glove_implementation" ||
      status === "subscribed")
  ) {
    reasons.push("Incomplete onboarding");
  }
  if (opts?.overdueInvoice) {
    reasons.push("Overdue invoice");
  }
  if ((relationship.supportOpenCount || 0) > 0) {
    reasons.push("Open support issue");
  }
  if (daysSince != null && daysSince > 30) {
    reasons.push("Declining activity");
  }

  // Deduplicate while preserving order
  const unique = [...new Set(reasons)];
  const badge = toCustomerHealthBadge(relationship.health, relationship.healthScore, {
    suspended: status === "suspended",
    accessDisabled: relationship.accessDisabled,
  });
  const tone: RiskTone =
    badge === "critical" || badge === "at_risk"
      ? "red"
      : badge === "needs_attention" || unique.length > 0
        ? "yellow"
        : "green";

  return { tone, reasons: unique };
}

/**
 * Apply Sales → CS transition on successful subscribe (same record).
 * Keeps Closed Won on Sales; opens Customer Success at Onboarding / Implementation.
 */
export function applySubscribeViewTransition(
  relationship: Relationship,
  opts?: { customerSuccessStage?: CustomerSuccessStage },
): void {
  relationship.salesStage = "closed_won";
  const fallback: CustomerSuccessStage =
    relationship.onboardingType === "white_glove" ? "implementation" : "onboarding";
  const existing = normalizeCustomerSuccessStage(
    relationship.customerSuccessStage,
    relationship,
  );
  const previous = existing;
  const next = opts?.customerSuccessStage ?? existing ?? fallback;
  relationship.customerSuccessStage = next;
  if (next !== previous && isCsAutoArrivalStage(next)) {
    markAutoArrival(relationship, next, "cs");
  }
}
