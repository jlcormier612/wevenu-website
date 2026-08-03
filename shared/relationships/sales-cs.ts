/**
 * Sales vs Customer Success — two views of one Relationship record.
 * Never duplicate. Filter by subscription / customer status; stages are view fields.
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
  | "discovery_scheduled"
  | "venue_walkthrough"
  | "proposal_sent"
  | "negotiation"
  | "awaiting_signature"
  | "won"
  | "lost"
  | "nurture";

/** Post-subscribe Customer Success lifecycle stages. */
export type CustomerSuccessStage =
  | "welcome"
  | "onboarding"
  | "implementation"
  | "training"
  | "live"
  | "adoption"
  | "healthy"
  | "expansion"
  | "renewal"
  | "renewed";

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
  { stage: "discovery_scheduled", label: "Discovery Scheduled", short: "Discovery" },
  { stage: "venue_walkthrough", label: "Venue Walkthrough", short: "Walkthrough" },
  { stage: "proposal_sent", label: "Proposal Sent", short: "Proposal" },
  { stage: "negotiation", label: "Negotiation", short: "Negotiation" },
  { stage: "awaiting_signature", label: "Awaiting Signature", short: "Signature" },
  { stage: "won", label: "Won", short: "Won" },
  { stage: "lost", label: "Lost", short: "Lost" },
  { stage: "nurture", label: "Nurture", short: "Nurture" },
];

export const CS_STAGE_COLUMNS: {
  stage: CustomerSuccessStage;
  label: string;
  short: string;
}[] = [
  { stage: "welcome", label: "Welcome", short: "Welcome" },
  { stage: "onboarding", label: "Onboarding", short: "Onboarding" },
  { stage: "implementation", label: "Implementation", short: "Impl" },
  { stage: "training", label: "Training", short: "Training" },
  { stage: "live", label: "Live", short: "Live" },
  { stage: "adoption", label: "Adoption", short: "Adoption" },
  { stage: "healthy", label: "Healthy", short: "Healthy" },
  { stage: "expansion", label: "Expansion", short: "Expansion" },
  { stage: "renewal", label: "Renewal", short: "Renewal" },
  { stage: "renewed", label: "Renewed", short: "Renewed" },
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

const SALES_STAGE_SET = new Set<string>(SALES_STAGE_COLUMNS.map((c) => c.stage));
const CS_STAGE_SET = new Set<string>(CS_STAGE_COLUMNS.map((c) => c.stage));

export function isSalesStage(value: string): value is SalesStage {
  return SALES_STAGE_SET.has(value);
}

export function isCustomerSuccessStage(value: string): value is CustomerSuccessStage {
  return CS_STAGE_SET.has(value);
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

/** True when this relationship belongs on the Sales board (pre-customer). */
export function isInSalesView(
  relationship: Pick<Relationship, "status" | "subscribedAt">,
): boolean {
  return !isInCustomerSuccessView(relationship);
}

/**
 * Happy-path rank for soft ingest promotion (mirrors promoteStatus).
 * lost / nurture sit below inquiry so re-engagement can advance.
 */
const SALES_STAGE_RANK: Record<SalesStage, number> = {
  lost: 5,
  nurture: 5,
  inquiry: 10,
  discovery_scheduled: 20,
  venue_walkthrough: 30,
  proposal_sent: 40,
  negotiation: 50,
  awaiting_signature: 60,
  won: 70,
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
      return "discovery_scheduled";
    case "walkthrough_scheduled":
    case "walkthrough_completed":
      return "venue_walkthrough";
    case "trial":
      return "negotiation";
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
      return "won";
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
  const cur = current && isSalesStage(current) ? current : "inquiry";
  if (!next || !isSalesStage(next)) return cur;
  if (SALES_STAGE_RANK[next] >= SALES_STAGE_RANK[cur]) return next;
  return cur;
}

/** Infer Sales stage from legacy lifecycle status when salesStage unset. */
export function deriveSalesStage(
  relationship: Pick<Relationship, "status" | "salesStage" | "subscribedAt">,
): SalesStage {
  if (relationship.salesStage && isSalesStage(relationship.salesStage)) {
    return relationship.salesStage;
  }
  if (isInCustomerSuccessView(relationship)) return "won";
  return salesStageFromLifecycleStatus(relationship.status);
}

/** Infer CS stage from legacy lifecycle status when customerSuccessStage unset. */
export function deriveCustomerSuccessStage(
  relationship: Pick<
    Relationship,
    "status" | "customerSuccessStage" | "onboardingType" | "health"
  >,
): CustomerSuccessStage {
  if (
    relationship.customerSuccessStage &&
    isCustomerSuccessStage(relationship.customerSuccessStage)
  ) {
    return relationship.customerSuccessStage;
  }

  const status = normalizeLifecycleStatus(relationship.status as RelationshipStatus);
  switch (status) {
    case "subscribed":
      return "welcome";
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
        return status === "referral" ? "adoption" : "healthy";
      }
      return status === "referral" ? "adoption" : "live";
    default:
      return "welcome";
  }
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

  const websitePublished = Boolean(
    extras?.websitePublished ??
      (relationship.websitePublished ||
        stepDone("website")),
  );
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
      id: "website",
      label: "Website Published",
      done: websitePublished,
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
  const websitePublished = Boolean(
    opts?.websitePublished ?? relationship.websitePublished,
  );
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
  if (
    (status === "active" || status === "reactivated" || status === "live") &&
    !websitePublished
  ) {
    reasons.push("Website unpublished");
  }
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

/** Apply Sales → CS transition on successful subscribe (same record). */
export function applySubscribeViewTransition(
  relationship: Relationship,
  opts?: { customerSuccessStage?: CustomerSuccessStage },
): void {
  relationship.salesStage = "won";
  relationship.customerSuccessStage =
    opts?.customerSuccessStage ?? relationship.customerSuccessStage ?? "welcome";
}
