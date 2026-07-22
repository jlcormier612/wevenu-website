import type { Relationship, Subscription, TimelineEvent } from "@/lib/types";
import { toPipelineStatus } from "@/lib/pipeline";

import {
  appendCommissionLedgerEntry,
  getCommissionLedgerSync,
  getCommissionPlanSync,
  getTeamProfileSync,
  getTeamProfilesSync,
  newProgram4Id,
  periodKeyFromIso,
} from "./store";
import type {
  CommissionEventType,
  CommissionLedgerEntry,
  CommissionPlan,
  CommissionRate,
} from "./types";

export function calculateCommissionCents(
  rate: CommissionRate | undefined,
  basisCents: number,
): number {
  if (!rate) return 0;
  if (rate.mode === "flat") return rate.cents;
  return Math.round((basisCents * rate.bps) / 10_000);
}

/** Map pipeline / timeline signals → commission event types. */
export function commissionEventFromStatus(status: string): CommissionEventType | null {
  const pipeline = toPipelineStatus(status as Parameters<typeof toPipelineStatus>[0]);
  switch (pipeline) {
    case "walkthrough_scheduled":
      return "walkthrough_booked";
    case "subscribed":
      return "subscription_sold";
    case "renewal":
      return "renewal";
    case "referral":
      return "referral";
    case "expansion":
      return "expansion";
    default:
      return null;
  }
}

export function commissionEventFromTimeline(type: string): CommissionEventType | null {
  switch (type) {
    case "walkthrough_scheduled":
    case "walkthrough_completed":
      return "walkthrough_booked";
    case "subscription_purchased":
      return "subscription_sold";
    case "white_glove_purchased":
      return "white_glove_sold";
    case "renewal":
      return "renewal";
    case "referral_submitted":
      return "referral";
    default:
      return null;
  }
}

function defaultBasisCents(
  eventType: CommissionEventType,
  relationship: Relationship,
  subscriptions: Subscription[],
): number {
  const sub = subscriptions.find((s) => s.relationshipId === relationship.id);
  const mrr = sub?.mrrCents ?? 0;

  switch (eventType) {
    case "subscription_sold":
    case "renewal":
    case "expansion":
      return mrr;
    default:
      return 0;
  }
}

/**
 * Create a ledger entry for a team member when a commissionable event occurs.
 * Idempotent on (sourceEventId, teamMemberId).
 */
export async function recordCommissionEvent(opts: {
  teamMemberId: string;
  relationship: Relationship;
  eventType: CommissionEventType;
  sourceEventId: string;
  occurredAt: string;
  basisCents?: number;
  subscriptions?: Subscription[];
  note?: string;
}): Promise<CommissionLedgerEntry | null> {
  const member = getTeamProfileSync(opts.teamMemberId);
  if (!member?.commissionPlanId || !member.active) return null;

  const plan = getCommissionPlanSync(member.commissionPlanId);
  if (!plan?.active) return null;

  const rate = plan.rates[opts.eventType];
  if (!rate) return null;

  const basis =
    opts.basisCents ??
    defaultBasisCents(opts.eventType, opts.relationship, opts.subscriptions ?? []);
  const commissionCents = calculateCommissionCents(rate, basis);
  if (commissionCents <= 0 && rate.mode === "percent" && basis <= 0) return null;

  const entry: CommissionLedgerEntry = {
    id: newProgram4Id("cl"),
    teamMemberId: opts.teamMemberId,
    relationshipId: opts.relationship.id,
    eventType: opts.eventType,
    sourceEventId: opts.sourceEventId,
    basisCents: basis,
    commissionCents,
    planId: plan.id,
    occurredAt: opts.occurredAt,
    periodKey: periodKeyFromIso(opts.occurredAt),
    status: "pending",
    note: opts.note,
  };

  return appendCommissionLedgerEntry(entry);
}

/**
 * Hook for pipeline status moves — credits the assigned owner (and sales on walkthrough).
 */
export async function recordCommissionsForStatusMove(opts: {
  relationship: Relationship;
  status: string;
  sourceEventId: string;
  occurredAt: string;
  subscriptions?: Subscription[];
}): Promise<void> {
  const eventType = commissionEventFromStatus(opts.status);
  if (!eventType) return;

  const assignee = opts.relationship.assignedTeamMemberId;
  if (assignee) {
    await recordCommissionEvent({
      teamMemberId: assignee,
      relationship: opts.relationship,
      eventType,
      sourceEventId: `${opts.sourceEventId}:${assignee}`,
      occurredAt: opts.occurredAt,
      subscriptions: opts.subscriptions,
      note: `Status → ${opts.status}`,
    });
  }

  // White Glove: also check onboarding type after subscribe/onboarding moves
  if (
    (opts.status === "subscribed" || opts.status === "onboarding") &&
    opts.relationship.onboardingType === "white_glove"
  ) {
    if (assignee) {
      await recordCommissionEvent({
        teamMemberId: assignee,
        relationship: opts.relationship,
        eventType: "white_glove_sold",
        sourceEventId: `${opts.sourceEventId}:wg:${assignee}`,
        occurredAt: opts.occurredAt,
        subscriptions: opts.subscriptions,
        note: "White Glove with subscription",
      });
    }
  }
}

/**
 * Derive missing ledger rows from timeline history (on-demand sync).
 * Credits the relationship assignee at the time of the event.
 */
export async function syncCommissionsFromTimeline(opts: {
  relationships: Relationship[];
  timelineEvents: TimelineEvent[];
  subscriptions: Subscription[];
}): Promise<number> {
  let created = 0;
  const existingKeys = new Set(
    getCommissionLedgerSync().map((e) => `${e.sourceEventId}::${e.teamMemberId}`),
  );

  for (const event of opts.timelineEvents) {
    const eventType = commissionEventFromTimeline(event.type);
    if (!eventType) continue;

    const relationship = opts.relationships.find((r) => r.id === event.relationshipId);
    if (!relationship) continue;

    const memberId = event.actorId || relationship.assignedTeamMemberId;
    if (!memberId) continue;

    const sourceEventId = `hist_${event.id}`;
    const key = `${sourceEventId}::${memberId}`;
    if (existingKeys.has(key)) continue;

    const result = await recordCommissionEvent({
      teamMemberId: memberId,
      relationship,
      eventType,
      sourceEventId,
      occurredAt: event.occurredAt,
      subscriptions: opts.subscriptions,
      note: event.title,
    });
    if (result) {
      created += 1;
      existingKeys.add(key);
    }
  }

  return created;
}

export function summarizeCommissionsByRep(
  entries: CommissionLedgerEntry[],
): { teamMemberId: string; totalCents: number; count: number }[] {
  const map = new Map<string, { totalCents: number; count: number }>();
  for (const e of entries) {
    if (e.status === "void") continue;
    const row = map.get(e.teamMemberId) ?? { totalCents: 0, count: 0 };
    row.totalCents += e.commissionCents;
    row.count += 1;
    map.set(e.teamMemberId, row);
  }
  return [...map.entries()]
    .map(([teamMemberId, v]) => ({ teamMemberId, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function formatRate(rate: CommissionRate): string {
  if (rate.mode === "flat") {
    return `$${(rate.cents / 100).toFixed(rate.cents % 100 === 0 ? 0 : 2)} flat`;
  }
  return `${(rate.bps / 100).toFixed(rate.bps % 100 === 0 ? 0 : 1)}%`;
}

export function planRateSummary(plan: CommissionPlan): string {
  const parts = Object.entries(plan.rates).map(([k, rate]) => {
    if (!rate) return null;
    return `${k.replace(/_/g, " ")}: ${formatRate(rate)}`;
  });
  return parts.filter(Boolean).join(" · ") || "No rates";
}

export function activeRepsWithPlans() {
  return getTeamProfilesSync().filter((m) => m.active && m.commissionPlanId);
}
