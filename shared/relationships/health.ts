/**
 * Relationship Health Score (0–100) — heuristic for Customer Lifecycle Engine.
 * Recommend-only for Luv; never auto-acts.
 */

import type {
  Communication,
  LiveRelationshipStore,
  Relationship,
  RelationshipHealth,
  RelationshipTask,
  TimelineEvent,
} from "./types";
import { normalizeLifecycleStatus } from "./status";
import { WHITE_GLOVE_CHECKLIST_MARKER } from "./white-glove-checklist";

const MS_DAY = 86_400_000;

export type RelationshipHealthSnapshot = {
  score: number;
  band: RelationshipHealth;
  lifecycleStage: string;
  lastLoginAt: string | null;
  loginCount30d: number;
  onboardingProgress: number;
  websitePublished: boolean;
  paymentStatus: string;
  lastCustomerActivityAt: string | null;
  lastTeamActivityAt: string | null;
  lastCommunicationAt: string | null;
  supportOpenCount: number;
  factors: string[];
};

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / MS_DAY);
}

function checklistProgress(
  tasks: RelationshipTask[],
  relationshipId: string,
): number {
  const list = tasks.filter(
    (t) =>
      t.relationshipId === relationshipId &&
      (t.meta?.checklist === WHITE_GLOVE_CHECKLIST_MARKER ||
        /White Glove implementation/i.test(t.description ?? "")),
  );
  if (list.length === 0) return 0;
  const done = list.filter((t) => t.status === "completed").length;
  return Math.round((done / list.length) * 100);
}

function latestCommAt(
  communications: Communication[],
  relationshipId: string,
): string | null {
  const list = communications
    .filter((c) => c.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return list[0]?.occurredAt ?? null;
}

function bandFromScore(score: number): RelationshipHealth {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "needs_attention";
  return "at_risk";
}

/**
 * Compute health score + display fields from Relationship + store slices.
 */
export function computeRelationshipHealth(
  relationship: Relationship,
  store: Pick<
    LiveRelationshipStore,
    "tasks" | "communications" | "timelineEvents" | "subscriptions"
  >,
  now: Date = new Date(),
): RelationshipHealthSnapshot {
  const factors: string[] = [];
  let score = 72;

  const status = normalizeLifecycleStatus(relationship.status);
  const payment =
    relationship.paymentStatus ||
    store.subscriptions.find((s) => s.relationshipId === relationship.id)?.status ||
    "none";

  if (status === "suspended" || relationship.accessDisabled) {
    score -= 45;
    factors.push("Account suspended / access disabled");
  } else if (status === "at_risk") {
    score -= 30;
    factors.push("Marked At Risk");
  } else if (status === "former_customer") {
    score -= 40;
    factors.push("Former customer");
  } else if (status === "active" || status === "reactivated") {
    score += 8;
    factors.push("Active customer");
  } else if (status === "onboarding" || status === "white_glove_implementation") {
    score -= 5;
    factors.push("Still in onboarding / implementation");
  }

  if (payment === "past_due" || payment === "failed") {
    score -= 25;
    factors.push("Payment past due / failed");
  } else if (payment === "paid" || payment === "manual" || payment === "active") {
    score += 6;
  }

  const loginDays = daysSince(relationship.lastLoginAt, now);
  const loginCount = relationship.loginCount30d ?? 0;
  if (relationship.activationCompletedAt || relationship.productSync?.ownerAccountId) {
    if (loginDays == null) {
      score -= 15;
      factors.push("No login after activation");
    } else if (loginDays > 21) {
      score -= 18;
      factors.push(`No login in ${loginDays} days`);
    } else if (loginDays > 7) {
      score -= 8;
      factors.push(`Last login ${loginDays} days ago`);
    } else {
      score += 5;
    }
    if (loginCount === 0 && loginDays != null && loginDays > 3) {
      score -= 5;
      factors.push("Zero logins in last 30 days");
    } else if (loginCount >= 4) {
      score += 4;
    }
  }

  const onboardingProgress =
    relationship.onboardingType === "white_glove"
      ? checklistProgress(store.tasks ?? [], relationship.id)
      : relationship.productSync?.status === "completed"
        ? 100
        : relationship.productSync?.status === "partial" ||
            relationship.productSync?.status === "running"
          ? 50
          : status === "onboarding"
            ? 25
            : status === "active" || status === "reactivated"
              ? 100
              : 0;

  if (relationship.onboardingType === "white_glove" && status === "white_glove_implementation") {
    if (onboardingProgress < 40) {
      score -= 12;
      factors.push("White Glove checklist stalled");
    } else if (onboardingProgress >= 80) {
      score += 6;
    }
  }

  const websitePublished = Boolean(
    relationship.websitePublished ||
      relationship.productSync?.steps?.find((s) => s.id === "website")?.status ===
        "completed",
  );
  if (websitePublished) {
    score += 5;
  } else if (status === "active" || status === "reactivated") {
    score -= 4;
    factors.push("Website not published");
  }

  const lastComm = latestCommAt(store.communications ?? [], relationship.id);
  const lastCustomer =
    relationship.lastCustomerActivityAt ||
    relationship.lastLoginAt ||
    null;
  const lastTeam =
    relationship.lastTeamActivityAt ||
    store.timelineEvents
      ?.filter(
        (e: TimelineEvent) =>
          e.relationshipId === relationship.id && Boolean(e.actorId),
      )
      .sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )[0]?.occurredAt ||
    null;

  const silenceDays = daysSince(lastCustomer || relationship.lastContactAt, now);
  if (silenceDays != null && silenceDays > 30 && (status === "active" || status === "reactivated")) {
    score -= 12;
    factors.push(`Inactive ${silenceDays} days`);
  }

  const supportOpen = relationship.supportOpenCount || 0;
  if (supportOpen >= 2) {
    score -= 10;
    factors.push(`${supportOpen} open support requests`);
  } else if (supportOpen === 1) {
    score -= 4;
    factors.push("Open support request");
  }

  if (relationship.dunning && !relationship.dunning.clearedAt) {
    score -= 10;
    factors.push("Active payment dunning");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    band: bandFromScore(score),
    lifecycleStage: relationship.currentStageLabel,
    lastLoginAt: relationship.lastLoginAt ?? null,
    loginCount30d: loginCount,
    onboardingProgress,
    websitePublished,
    paymentStatus: String(payment),
    lastCustomerActivityAt: lastCustomer,
    lastTeamActivityAt: lastTeam,
    lastCommunicationAt: lastComm,
    supportOpenCount: supportOpen,
    factors,
  };
}

/** Persist score + health band onto the Relationship (mutate in place). */
export function applyHealthSnapshot(
  relationship: Relationship,
  snapshot: RelationshipHealthSnapshot,
): void {
  relationship.healthScore = snapshot.score;
  relationship.health = snapshot.band;
}
