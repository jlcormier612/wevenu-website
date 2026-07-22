/**
 * Project 4 — Founder Dashboard metrics.
 * Computed from live/seed relationships + subscriptions (not a static remaining counter).
 */

import {
  computeFounderRemaining,
  getFounderProgramCapacity,
} from "@shared/relationships";

import type {
  Relationship,
  Subscription,
  TimelineEvent,
  WorkspaceData,
} from "@/lib/types";

const PLAN_MRR_ESTIMATE: Record<string, number> = {
  gather: 14900,
  celebrate: 24900,
  flourish: 39900,
  none: 24900,
};

const VELOCITY_WINDOW_DAYS = 30;
/** Need at least this many recent founders before projecting a close date. */
const MIN_VELOCITY_SAMPLES = 2;

export type FounderActivityItem = {
  id: string;
  relationshipId: string;
  venueName: string;
  title: string;
  body?: string;
  occurredAt: string;
  type: TimelineEvent["type"];
};

export type FounderDashboardMetrics = {
  capacity: number;
  foundingCount: number;
  remaining: number;
  /** ISO date string, or null when velocity is insufficient. */
  estimatedCloseDate: string | null;
  estimatedCloseNote: string;
  /** Monthly founder MRR from active subs or plan estimates. */
  projectedMrrCents: number;
  /** Stub cumulative: sum of (monthly MRR × months since start). */
  founderRevenueCents: number;
  founderRevenueNote: string;
  welcomeBackApproved: number;
  welcomeBackPending: number;
  welcomeBackRejected: number;
  welcomeBackExpired: number;
  welcomeBackTotal: number;
  newThisWeek: number;
  velocityPerDay: number;
  founders: Relationship[];
  recentActivity: FounderActivityItem[];
};

function founderAcquiredAt(
  relationship: Relationship,
  timeline: TimelineEvent[],
  subscriptions: Subscription[],
): number {
  const founderEvents = timeline.filter(
    (e) =>
      e.relationshipId === relationship.id &&
      (e.type === "founder_status_assigned" ||
        (e.type === "subscription_purchased" &&
          e.meta?.founding_member === true)),
  );
  if (founderEvents.length > 0) {
    return Math.min(...founderEvents.map((e) => new Date(e.occurredAt).getTime()));
  }
  const sub = subscriptions.find(
    (s) => s.relationshipId === relationship.id && s.foundingMember,
  );
  if (sub) return new Date(sub.startedAt).getTime();
  return new Date(relationship.createdAt).getTime();
}

function monthsSince(iso: string, now: Date): number {
  const start = new Date(iso);
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    (now.getDate() - start.getDate()) / 30;
  return Math.max(1, Math.round(months * 10) / 10);
}

function mrrForFounder(
  relationship: Relationship,
  subscriptions: Subscription[],
): number {
  const sub = subscriptions.find((s) => s.relationshipId === relationship.id);
  if (sub && (sub.status === "active" || sub.status === "trialing") && sub.mrrCents > 0) {
    return sub.mrrCents;
  }
  if (sub && sub.mrrCents > 0 && sub.status !== "cancelled") {
    return sub.mrrCents;
  }
  return PLAN_MRR_ESTIMATE[relationship.planId] ?? PLAN_MRR_ESTIMATE.none;
}

const ACTIVITY_TYPES = new Set<TimelineEvent["type"]>([
  "founder_status_assigned",
  "welcome_back_requested",
  "welcome_back_verified",
  "welcome_back_rejected",
  "welcome_back_follow_up",
  "welcome_back_expired",
  "subscription_purchased",
  "subscription_updated",
  "subscription_cancelled",
]);

export function computeFounderDashboardMetrics(
  data: WorkspaceData,
  now = new Date(),
): FounderDashboardMetrics {
  const relationships = data.relationships;
  const subscriptions = data.subscriptions;
  const timeline = data.timelineEvents;

  const founders = relationships
    .filter((r) => r.foundingMember)
    .sort(
      (a, b) =>
        founderAcquiredAt(b, timeline, subscriptions) -
        founderAcquiredAt(a, timeline, subscriptions),
    );

  const capacity = getFounderProgramCapacity();
  const foundingCount = founders.length;
  const remaining = computeFounderRemaining(foundingCount, capacity);

  const weekAgo = now.getTime() - 7 * 86_400_000;
  const newThisWeek = founders.filter(
    (r) => founderAcquiredAt(r, timeline, subscriptions) >= weekAgo,
  ).length;

  const windowStart = now.getTime() - VELOCITY_WINDOW_DAYS * 86_400_000;
  const recentAcquisitions = founders.filter(
    (r) => founderAcquiredAt(r, timeline, subscriptions) >= windowStart,
  );
  const velocityPerDay =
    recentAcquisitions.length / VELOCITY_WINDOW_DAYS;

  let estimatedCloseDate: string | null = null;
  let estimatedCloseNote =
    "Needs more recent founder activity to project a close date";

  if (remaining === 0) {
    estimatedCloseDate = now.toISOString();
    estimatedCloseNote = "Founder program capacity reached";
  } else if (
    recentAcquisitions.length >= MIN_VELOCITY_SAMPLES &&
    velocityPerDay > 0
  ) {
    const daysNeeded = Math.ceil(remaining / velocityPerDay);
    const close = new Date(now.getTime() + daysNeeded * 86_400_000);
    estimatedCloseDate = close.toISOString();
    estimatedCloseNote = `Based on ${recentAcquisitions.length} founders in the last ${VELOCITY_WINDOW_DAYS} days`;
  }

  let projectedMrrCents = 0;
  let founderRevenueCents = 0;
  for (const r of founders) {
    const mrr = mrrForFounder(r, subscriptions);
    projectedMrrCents += mrr;
    const sub = subscriptions.find((s) => s.relationshipId === r.id);
    const startIso = sub?.startedAt ?? r.createdAt;
    founderRevenueCents += Math.round(mrr * monthsSince(startIso, now));
  }

  const welcomeBack = relationships.filter((r) => r.welcomeBackRequested);
  const welcomeBackApproved = welcomeBack.filter(
    (r) => r.welcomeBackVerified === "verified",
  ).length;
  const welcomeBackPending = welcomeBack.filter(
    (r) => r.welcomeBackVerified === "pending",
  ).length;
  const welcomeBackRejected = welcomeBack.filter(
    (r) => r.welcomeBackVerified === "rejected",
  ).length;
  const welcomeBackExpired = welcomeBack.filter(
    (r) => r.welcomeBackVerified === "expired",
  ).length;

  const founderIds = new Set(founders.map((r) => r.id));
  const nameById = new Map(relationships.map((r) => [r.id, r.venue.name]));

  const recentActivity: FounderActivityItem[] = timeline
    .filter(
      (e) =>
        ACTIVITY_TYPES.has(e.type) &&
        (founderIds.has(e.relationshipId) ||
          e.type.startsWith("welcome_back") ||
          e.meta?.founding_member === true),
    )
    .map((e) => ({
      id: e.id,
      relationshipId: e.relationshipId,
      venueName: nameById.get(e.relationshipId) ?? "Venue",
      title: e.title,
      body: e.body,
      occurredAt: e.occurredAt,
      type: e.type,
    }))
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, 12);

  return {
    capacity,
    foundingCount,
    remaining,
    estimatedCloseDate,
    estimatedCloseNote,
    projectedMrrCents,
    founderRevenueCents,
    founderRevenueNote:
      "Estimated cumulative — monthly MRR × months since start (stub)",
    welcomeBackApproved,
    welcomeBackPending,
    welcomeBackRejected,
    welcomeBackExpired,
    welcomeBackTotal: welcomeBack.length,
    newThisWeek,
    velocityPerDay,
    founders,
    recentActivity,
  };
}
