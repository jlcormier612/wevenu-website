/**
 * Customer Lifecycle Engine — Phase 1 actions.
 *
 * One Relationship. Status changes. Never duplicate. Everything appends to timeline.
 */

import { randomUUID } from "crypto";

import { applyHealthSnapshot, computeRelationshipHealth } from "./health";
import { mapPlanId, planDisplayName } from "./normalize";
import { applySubscribeViewTransition } from "./sales-cs";
import {
  mutateRelationship,
  type FindOrCreateResult,
} from "./service";
import { stageLabelForStatus } from "./status";
import { loadLiveStore, withLiveStore } from "./store";
import type {
  DunningDay,
  OnboardingType,
  PlanId,
  Relationship,
  RelationshipStatus,
} from "./types";
import { DUNNING_DAYS } from "./types";
import {
  ensureWhiteGloveChecklist,
  ensureWhiteGloveChecklistInStore,
  WHITE_GLOVE_CHECKLIST_MARKER,
  WHITE_GLOVE_CHECKLIST_OWNER_ID,
  WHITE_GLOVE_CHECKLIST_TITLES,
} from "./white-glove-checklist";

function shortId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function newActivationToken(): string {
  return `act_${randomUUID().replace(/-/g, "")}`;
}

function daysBetween(startIso: string, now: Date): number {
  const t = new Date(startIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Default White Glove delivery window (business days) when settings unset. */
export const DEFAULT_WHITE_GLOVE_TIMELINE_DAYS = { min: 5, max: 7 } as const;

export type WhiteGloveTimelineSettings = {
  minBusinessDays: number;
  maxBusinessDays: number;
};

export function whiteGloveTimelineLabel(
  settings?: Partial<WhiteGloveTimelineSettings> | null,
): string {
  const min = settings?.minBusinessDays ?? DEFAULT_WHITE_GLOVE_TIMELINE_DAYS.min;
  const max = settings?.maxBusinessDays ?? DEFAULT_WHITE_GLOVE_TIMELINE_DAYS.max;
  if (min === max) return `${min} business days`;
  return `${min}–${max} business days`;
}

/**
 * After successful purchase: Subscribed → onboarding path.
 * Launch Yourself → onboarding + activation token (caller sends welcome + product sync).
 * White Glove → white_glove_implementation, checklist, NO product access yet.
 */
export async function enterOnboardingAfterPurchase(input: {
  relationshipId: string;
  onboardingType: OnboardingType;
  actorId?: string;
  assignOwnerId?: string;
  wgTimeline?: Partial<WhiteGloveTimelineSettings> | null;
}): Promise<Relationship | null> {
  const now = new Date().toISOString();
  const isWg = input.onboardingType === "white_glove";

  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === input.relationshipId);
    if (!relationship) return null;

    relationship.status = isWg ? "white_glove_implementation" : "onboarding";
    relationship.currentStageLabel = stageLabelForStatus(relationship.status);
    relationship.onboardingType = isWg
      ? "white_glove"
      : relationship.onboardingType === "white_glove"
        ? "white_glove"
        : "self_guided";
    relationship.paymentStatus = relationship.paymentStatus || "paid";
    relationship.subscribedAt = relationship.subscribedAt || now;
    // Same Relationship ID — leave Sales view, enter Customer Success.
    applySubscribeViewTransition(relationship, {
      customerSuccessStage: isWg ? "implementation" : "onboarding",
    });
    relationship.updatedAt = now;
    relationship.lastContactAt = now;
    relationship.lastTeamActivityAt = now;

    const extra: Array<{
      type:
        | "subscription_activated"
        | "welcome_workflow_started"
        | "onboarding_created"
        | "white_glove_implementation_started";
      title: string;
      body?: string;
    }> = [
      {
        type: "subscription_activated",
        title: "Subscription Activated",
        body: `${relationship.planName} is active.`,
      },
      {
        type: "welcome_workflow_started",
        title: "Welcome Workflow Started",
        body: isWg
          ? "White Glove welcome path — credentials deferred until Launch Workspace."
          : "Launch Yourself welcome path started.",
      },
      {
        type: "onboarding_created",
        title: "Onboarding Created",
        body: isWg
          ? "Implementation project created (White Glove checklist)."
          : "Self-guided onboarding created with activation token.",
      },
    ];

    if (isWg) {
      relationship.assignedTeamMemberId =
        input.assignOwnerId?.trim() ||
        relationship.assignedTeamMemberId ||
        WHITE_GLOVE_CHECKLIST_OWNER_ID;
      relationship.nextMilestone = "Venue branding";
      relationship.accessDisabled = true;
      relationship.activationToken = null;
      extra.push({
        type: "white_glove_implementation_started",
        title: "White Glove Implementation Started",
        body: `Team will prepare ${relationship.venue.name} over approximately ${whiteGloveTimelineLabel(input.wgTimeline)}.`,
      });
      ensureWhiteGloveChecklistInStore(store, relationship.id, {
        ownerId: relationship.assignedTeamMemberId,
        now,
        actorId: input.actorId,
      });
    } else {
      relationship.accessDisabled = false;
      if (!relationship.activationToken) {
        relationship.activationToken = newActivationToken();
        relationship.activationTokenCreatedAt = now;
      }
      relationship.nextMilestone = "Self-guided setup";
    }

    for (const ev of extra) {
      store.timelineEvents.push({
        id: shortId("evt"),
        relationshipId: relationship.id,
        type: ev.type,
        title: ev.title,
        body: ev.body,
        occurredAt: now,
        actorId: input.actorId,
      });
    }

    if (isWg) {
      store.notifications.push({
        id: shortId("ntf"),
        type: "white_glove_implementation",
        relationshipId: relationship.id,
        title: "White Glove Implementation",
        body: `${relationship.venue.name} needs Implementation — assigned to ${relationship.assignedTeamMemberId}.`,
        createdAt: now,
        read: false,
      });
    }

    const health = computeRelationshipHealth(relationship, store);
    applyHealthSnapshot(relationship, health);
    return relationship;
  });

  return result;
}

/** Path 3 — Manual Subscription (Owner/Admin, no Stripe). */
export async function createManualSubscription(input: {
  relationshipId: string;
  planId?: PlanId | string | null;
  planName?: string | null;
  onboardingType?: "self_guided" | "white_glove";
  foundingMember?: boolean;
  mrrCents?: number;
  actorId?: string;
  notes?: string;
}): Promise<FindOrCreateResult | null> {
  const store = await loadLiveStore();
  const existing = store.relationships.find((r) => r.id === input.relationshipId);
  if (!existing) return null;

  const planId = mapPlanId(input.planId ?? existing.planId);
  const resolvedPlanId = planId === "none" ? "gather" : planId;
  const planName = planDisplayName(resolvedPlanId, input.planName ?? existing.planName);
  const onboardingType = input.onboardingType ?? (existing.onboardingType === "white_glove" ? "white_glove" : "self_guided");
  const now = new Date().toISOString();

  const result = await mutateRelationship({
    find: {
      email: existing.owner.email,
      venueName: existing.venue.name,
      stripeCustomerId: existing.stripeCustomerId,
      stripeSubscriptionId: existing.stripeSubscriptionId,
    },
    updateOnly: true,
    forceStatus: "subscribed",
    patch: {
      planId: resolvedPlanId,
      planName,
      onboardingType,
      foundingMember: input.foundingMember ? true : undefined,
      paymentStatus: "manual",
      subscribedAt: now,
      currentStageLabel: "Subscribed",
      salesStage: "won",
      customerSuccessStage: "welcome",
      notes: input.notes,
    },
    event: {
      type: "manual_subscription",
      title: `Manual Subscription — ${planName}`,
      body: input.notes?.trim() || "Subscription recorded without Stripe.",
      occurredAt: now,
      actorId: input.actorId,
      meta: {
        plan: resolvedPlanId,
        onboarding_type: onboardingType,
        manual: true,
      },
    },
    subscription: {
      planId: resolvedPlanId,
      planName,
      status: "active",
      mrrCents: input.mrrCents ?? 0,
      startedAt: now,
      foundingMember: Boolean(input.foundingMember ?? existing.foundingMember),
      manual: true,
    },
    notification: {
      type: "subscription_purchased",
      title: "Manual subscription",
      body: `${existing.venue.name} marked subscribed (${planName}).`,
      createdAt: now,
    },
  });

  if (result?.relationship) {
    await enterOnboardingAfterPurchase({
      relationshipId: result.relationship.id,
      onboardingType,
      actorId: input.actorId,
    });
  }

  return result;
}

/** Required WG tasks for Launch Workspace (all 8, or Owner override). */
export function whiteGloveLaunchReady(
  relationshipId: string,
  tasks: { relationshipId: string; title: string; status: string; meta?: Record<string, string | number | boolean | null> }[],
): { ready: boolean; completed: number; total: number; missing: string[] } {
  const checklist = tasks.filter(
    (t) =>
      t.relationshipId === relationshipId &&
      (t.meta?.checklist === WHITE_GLOVE_CHECKLIST_MARKER ||
        (WHITE_GLOVE_CHECKLIST_TITLES as readonly string[]).includes(t.title)),
  );
  const byTitle = new Map(checklist.map((t) => [t.title, t]));
  const missing: string[] = [];
  for (const title of WHITE_GLOVE_CHECKLIST_TITLES) {
    const task = byTitle.get(title);
    if (!task || task.status !== "completed") missing.push(title);
  }
  const completed = WHITE_GLOVE_CHECKLIST_TITLES.length - missing.length;
  return {
    ready: missing.length === 0,
    completed,
    total: WHITE_GLOVE_CHECKLIST_TITLES.length,
    missing,
  };
}

/**
 * Launch Workspace after White Glove — create activation, status → active,
 * timeline Implementation Complete / Welcome Sent / Workspace Activated.
 * Caller sends Welcome Home email.
 */
export async function launchWhiteGloveWorkspace(input: {
  relationshipId: string;
  actorId?: string;
  ownerOverride?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  relationship?: Relationship;
  activationToken?: string;
}> {
  const store = await loadLiveStore();
  const existing = store.relationships.find((r) => r.id === input.relationshipId);
  if (!existing) {
    return { ok: false, message: "Relationship not found." };
  }

  const readiness = whiteGloveLaunchReady(input.relationshipId, store.tasks ?? []);
  if (!readiness.ready && !input.ownerOverride) {
    return {
      ok: false,
      message: `Complete required tasks first (${readiness.completed}/${readiness.total}). Missing: ${readiness.missing.join(", ")}. Owner can override.`,
    };
  }

  const now = new Date().toISOString();
  const token = existing.activationToken || newActivationToken();

  const { result } = await withLiveStore((s) => {
    const relationship = s.relationships.find((r) => r.id === input.relationshipId);
    if (!relationship) return null;

    relationship.status = "active";
    relationship.currentStageLabel = "Active";
    relationship.salesStage = "won";
    relationship.customerSuccessStage = "live";
    relationship.accessDisabled = false;
    relationship.activationToken = token;
    relationship.activationTokenCreatedAt =
      relationship.activationTokenCreatedAt || now;
    relationship.updatedAt = now;
    relationship.lastContactAt = now;
    relationship.lastTeamActivityAt = now;
    relationship.nextMilestone = "Workspace activated";
    relationship.paymentStatus = relationship.paymentStatus || "paid";

    const events: Array<{ type: "implementation_complete" | "workspace_activated" | "onboarding_completed"; title: string; body?: string }> = [
      {
        type: "implementation_complete",
        title: "Implementation Complete",
        body: input.ownerOverride && !readiness.ready
          ? `Owner override — launched with ${readiness.completed}/${readiness.total} checklist items complete.`
          : "White Glove checklist complete.",
      },
      {
        type: "workspace_activated",
        title: "Workspace Activated",
        body: "Customer account / activation token ready.",
      },
      {
        type: "onboarding_completed",
        title: "Onboarding Completed",
        body: "White Glove implementation handed off to live workspace.",
      },
    ];

    for (const ev of events) {
      s.timelineEvents.push({
        id: shortId("evt"),
        relationshipId: relationship.id,
        type: ev.type,
        title: ev.title,
        body: ev.body,
        occurredAt: now,
        actorId: input.actorId,
        meta: {
          owner_override: Boolean(input.ownerOverride && !readiness.ready),
          activation_token_set: true,
        },
      });
    }

    s.notifications.push({
      id: shortId("ntf"),
      type: "workspace_launched",
      relationshipId: relationship.id,
      title: "Workspace launched",
      body: `${relationship.venue.name} is Active — Welcome Home email should send.`,
      createdAt: now,
      read: false,
    });

    const health = computeRelationshipHealth(relationship, s);
    applyHealthSnapshot(relationship, health);
    return relationship;
  });

  if (!result) return { ok: false, message: "Failed to launch workspace." };

  return {
    ok: true,
    message: "Workspace launched.",
    relationship: result,
    activationToken: token,
  };
}

export async function suspendRelationshipAccount(input: {
  relationshipId: string;
  actorId?: string;
  reason?: string;
  fromDunning?: boolean;
}): Promise<Relationship | null> {
  const now = new Date().toISOString();
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === input.relationshipId);
    if (!relationship) return null;

    relationship.status = "suspended";
    relationship.currentStageLabel = "Suspended";
    relationship.accessDisabled = true;
    relationship.updatedAt = now;
    relationship.lastTeamActivityAt = now;
    if (relationship.dunning) {
      relationship.dunning = {
        ...relationship.dunning,
        suspendedAt: now,
        lastReminderDay: 21,
        lastReminderAt: now,
      };
    }

    store.timelineEvents.push({
      id: shortId("evt"),
      relationshipId: relationship.id,
      type: "account_suspended",
      title: "Account Suspended",
      body:
        input.reason?.trim() ||
        (input.fromDunning
          ? "Suspended after 21-day failed payment dunning. Data preserved."
          : "Account suspended by team. Data preserved."),
      occurredAt: now,
      actorId: input.actorId,
      meta: { from_dunning: Boolean(input.fromDunning) },
    });

    store.notifications.push({
      id: shortId("ntf"),
      type: "account_suspended",
      relationshipId: relationship.id,
      title: "Account suspended",
      body: `${relationship.venue.name} access disabled.`,
      createdAt: now,
      read: false,
    });

    applyHealthSnapshot(relationship, computeRelationshipHealth(relationship, store));
    return relationship;
  });
  return result;
}

export async function reactivateRelationshipAccount(input: {
  relationshipId: string;
  actorId?: string;
  reason?: string;
  fromPaymentSuccess?: boolean;
}): Promise<Relationship | null> {
  const now = new Date().toISOString();
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === input.relationshipId);
    if (!relationship) return null;

    relationship.status = "reactivated";
    relationship.currentStageLabel = "Reactivated";
    relationship.accessDisabled = false;
    relationship.paymentStatus = "paid";
    relationship.updatedAt = now;
    relationship.lastContactAt = now;
    relationship.lastTeamActivityAt = now;
    if (relationship.dunning) {
      relationship.dunning = {
        ...relationship.dunning,
        clearedAt: now,
      };
    } else {
      relationship.dunning = null;
    }

    for (const sub of store.subscriptions) {
      if (sub.relationshipId === relationship.id && sub.status === "past_due") {
        sub.status = "active";
      }
    }

    store.timelineEvents.push({
      id: shortId("evt"),
      relationshipId: relationship.id,
      type: "account_reactivated",
      title: "Account Reactivated",
      body:
        input.reason?.trim() ||
        (input.fromPaymentSuccess
          ? "Payment succeeded — access restored."
          : "Account reactivated by team."),
      occurredAt: now,
      actorId: input.actorId,
      meta: { from_payment_success: Boolean(input.fromPaymentSuccess) },
    });

    store.notifications.push({
      id: shortId("ntf"),
      type: "account_reactivated",
      relationshipId: relationship.id,
      title: "Account reactivated",
      body: `${relationship.venue.name} is back — Reactivated.`,
      createdAt: now,
      read: false,
    });

    applyHealthSnapshot(relationship, computeRelationshipHealth(relationship, store));
    return relationship;
  });
  return result;
}

/**
 * Start or advance dunning after invoice.payment_failed / past_due.
 * Returns which reminder day (if any) should send email now.
 */
export async function recordPaymentFailed(input: {
  relationshipId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  email?: string | null;
  invoiceId?: string | null;
  now?: Date;
}): Promise<{
  relationship: Relationship | null;
  reminderDay: DunningDay | null;
  shouldNotifyInternal: boolean;
  shouldSuspend: boolean;
  shouldMarkAtRisk: boolean;
}> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const { result } = await withLiveStore((store) => {
    let relationship =
      (input.relationshipId
        ? store.relationships.find((r) => r.id === input.relationshipId)
        : undefined) ||
      (input.stripeSubscriptionId
        ? store.relationships.find(
            (r) => r.stripeSubscriptionId === input.stripeSubscriptionId,
          )
        : undefined) ||
      (input.stripeCustomerId
        ? store.relationships.find(
            (r) => r.stripeCustomerId === input.stripeCustomerId,
          )
        : undefined) ||
      (input.email
        ? store.relationships.find(
            (r) =>
              (r.owner.email || "").trim().toLowerCase() ===
              input.email!.trim().toLowerCase(),
          )
        : undefined);

    if (!relationship) {
      return {
        relationship: null as Relationship | null,
        reminderDay: null as DunningDay | null,
        shouldNotifyInternal: false,
        shouldSuspend: false,
        shouldMarkAtRisk: false,
      };
    }

    relationship.paymentStatus = "failed";
    relationship.updatedAt = nowIso;

    for (const sub of store.subscriptions) {
      if (
        sub.relationshipId === relationship.id ||
        (input.stripeSubscriptionId &&
          sub.stripeSubscriptionId === input.stripeSubscriptionId)
      ) {
        if (sub.status !== "cancelled") sub.status = "past_due";
      }
    }

    if (!relationship.dunning || relationship.dunning.clearedAt) {
      relationship.dunning = {
        startedAt: nowIso,
        lastReminderDay: null,
      };
    }

    const elapsed = daysBetween(relationship.dunning.startedAt, now);
    const dueDay =
      [...DUNNING_DAYS].reverse().find((d) => elapsed >= d) ?? null;
    const last = relationship.dunning.lastReminderDay;
    const reminderDay =
      dueDay != null && (last == null || dueDay > last) ? dueDay : null;

    let shouldMarkAtRisk = false;
    let shouldSuspend = false;
    let shouldNotifyInternal = false;

    if (reminderDay === 0 || reminderDay === 3 || reminderDay === 7) {
      // email only
    }
    if (reminderDay === 14 || (elapsed >= 14 && !relationship.dunning.atRiskAt)) {
      shouldMarkAtRisk = true;
      shouldNotifyInternal = true;
      relationship.status = "at_risk";
      relationship.currentStageLabel = "At Risk";
      relationship.health = "at_risk";
      relationship.dunning.atRiskAt = relationship.dunning.atRiskAt || nowIso;
    }
    if (reminderDay === 21 || (elapsed >= 21 && !relationship.dunning.suspendedAt)) {
      shouldSuspend = true;
      shouldNotifyInternal = true;
    }

    store.timelineEvents.push({
      id: shortId("evt"),
      relationshipId: relationship.id,
      type: "payment_failed",
      title: "Payment Failed",
      body: input.invoiceId
        ? `Invoice ${input.invoiceId} payment failed.`
        : "Subscription payment failed.",
      occurredAt: nowIso,
      meta: {
        invoice_id: input.invoiceId ?? null,
        dunning_day: reminderDay,
        elapsed_days: elapsed,
      },
    });

    if (shouldNotifyInternal) {
      store.notifications.push({
        id: shortId("ntf"),
        type: shouldSuspend ? "account_suspended" : "account_at_risk",
        relationshipId: relationship.id,
        title: shouldSuspend ? "Suspend after dunning" : "At Risk — payment",
        body: `${relationship.venue.name}: dunning day ${elapsed}.`,
        createdAt: nowIso,
        read: false,
      });
    }

    applyHealthSnapshot(relationship, computeRelationshipHealth(relationship, store));

    return {
      relationship,
      reminderDay,
      shouldNotifyInternal,
      shouldSuspend,
      shouldMarkAtRisk,
    };
  });

  if (result.shouldSuspend && result.relationship) {
    await suspendRelationshipAccount({
      relationshipId: result.relationship.id,
      fromDunning: true,
      reason: "Day 21 dunning — payment still failed.",
    });
    const refreshed = await loadLiveStore();
    result.relationship =
      refreshed.relationships.find((r) => r.id === result.relationship!.id) ??
      result.relationship;
  }

  return result;
}

/** Mark that a dunning reminder email was sent for a given day. */
export async function markDunningReminderSent(
  relationshipId: string,
  day: DunningDay,
): Promise<void> {
  const now = new Date().toISOString();
  await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship?.dunning) return;
    relationship.dunning.lastReminderDay = day;
    relationship.dunning.lastReminderAt = now;
    store.timelineEvents.push({
      id: shortId("evt"),
      relationshipId,
      type: "payment_reminder_sent",
      title: `Payment Reminder (Day ${day})`,
      body: `Dunning reminder sent for day ${day}.`,
      occurredAt: now,
      meta: { dunning_day: day },
    });
  });
}

/**
 * Tick all relationships with active dunning — advance day 0/3/7/14/21.
 * Call from cron / webhook / workspace smoke endpoint.
 */
export async function tickPaymentDunning(now: Date = new Date()): Promise<
  Array<{
    relationshipId: string;
    reminderDay: DunningDay | null;
    shouldSuspend: boolean;
    shouldMarkAtRisk: boolean;
  }>
> {
  const store = await loadLiveStore();
  const out: Array<{
    relationshipId: string;
    reminderDay: DunningDay | null;
    shouldSuspend: boolean;
    shouldMarkAtRisk: boolean;
  }> = [];

  for (const relationship of store.relationships) {
    if (!relationship.dunning || relationship.dunning.clearedAt) continue;
    if (relationship.status === "former_customer") continue;

    const result = await recordPaymentFailed({
      relationshipId: relationship.id,
      stripeCustomerId: relationship.stripeCustomerId,
      stripeSubscriptionId: relationship.stripeSubscriptionId,
      now,
    });
    out.push({
      relationshipId: relationship.id,
      reminderDay: result.reminderDay,
      shouldSuspend: result.shouldSuspend,
      shouldMarkAtRisk: result.shouldMarkAtRisk,
    });
  }

  return out;
}

/** Refresh health score for one relationship (snapshot / tick). */
export async function refreshRelationshipHealth(
  relationshipId: string,
): Promise<ReturnType<typeof computeRelationshipHealth> | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;
    const snapshot = computeRelationshipHealth(relationship, store);
    applyHealthSnapshot(relationship, snapshot);
    relationship.updatedAt = new Date().toISOString();
    return snapshot;
  });
  return result;
}

export async function recordSubscriptionLinkSent(input: {
  relationshipId: string;
  checkoutUrl: string;
  planTier: string;
  actorId?: string;
  emailed: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === input.relationshipId);
    if (!relationship) return;
    relationship.updatedAt = now;
    relationship.lastTeamActivityAt = now;
    store.timelineEvents.push({
      id: shortId("evt"),
      relationshipId: input.relationshipId,
      type: "subscription_link_sent",
      title: "Subscription Link Sent",
      body: input.emailed
        ? `Checkout link emailed for ${input.planTier}.`
        : `Checkout link generated for ${input.planTier} (copy to clipboard).`,
      occurredAt: now,
      actorId: input.actorId,
      meta: {
        plan_tier: input.planTier,
        emailed: input.emailed,
        // Do not store full URL in timeline meta long-term — truncated for audit.
        checkout_host: (() => {
          try {
            return new URL(input.checkoutUrl).host;
          } catch {
            return null;
          }
        })(),
      },
    });
  });
}

export type LifecycleForceStatus = Extract<
  RelationshipStatus,
  | "subscribed"
  | "onboarding"
  | "white_glove_implementation"
  | "active"
  | "at_risk"
  | "suspended"
  | "reactivated"
  | "former_customer"
>;

/** Ensure checklist exists (re-export convenience). */
export { ensureWhiteGloveChecklist };
