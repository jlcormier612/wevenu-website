/**
 * Project 9 — Business Dashboard metrics.
 *
 * Company-level numbers for Owner + Finance (Administrator also allowed via
 * view_business_dashboard). Computed from seed and/or live relationships,
 * subscriptions, invoices, walkthroughs, tasks, and timeline — no chart library.
 */

import {
  computeFounderRemaining,
  getFounderProgramCapacity,
  WHITE_GLOVE_CHECKLIST_MARKER,
} from "@shared/relationships";

import { normalizeRelationshipStatus, toPipelineStatus } from "@/lib/pipeline";
import type {
  Relationship,
  Subscription,
  Task,
  TimelineEvent,
  WorkspaceData,
} from "@/lib/types";

const PLAN_MRR_ESTIMATE: Record<string, number> = {
  gather: 14900,
  celebrate: 24900,
  flourish: 39900,
  none: 24900,
};

/** Pipeline statuses that count as paying / converted customers. */
const SUBSCRIBED_PLUS = new Set([
  "subscribed",
  "onboarding",
  "white_glove_implementation",
  "live",
  "active",
  "reactivated",
  "at_risk",
  "expansion",
  "referral",
  "renewal",
]);

const PIPELINE_OPEN = new Set([
  "inquiry",
  "walkthrough_requested",
  "walkthrough_scheduled",
  "walkthrough_completed",
  "trial",
]);

/** Close-rate assumption for projected ARR — clearly labeled as estimate. */
const PIPELINE_CLOSE_RATE = 0.6;

export type MetricConfidence = "actual" | "estimate" | "empty";

export type SubscriptionGrowthRow = {
  key: string;
  label: string;
  newSubs: number;
  /** New-sub MRR started that month (actual when known). */
  mrrCents: number;
};

export type BusinessDashboardMetrics = {
  /** Active + trialing subscription MRR. */
  mrrCents: number;
  mrrConfidence: MetricConfidence;
  arrCents: number;
  arrConfidence: MetricConfidence;
  /** Paid invoice totals (collected). */
  revenueCents: number;
  revenueConfidence: MetricConfidence;
  revenueNote: string;

  churnPercent: number;
  churnCount: number;
  churnBase: number;
  churnNote: string;

  trialCount: number;
  trialNote: string;

  walkthroughCompleted: number;
  walkthroughConverted: number;
  walkthroughConversionPercent: number | null;
  walkthroughConversionNote: string;

  inquiryCount: number;
  inquiryConverted: number;
  inquiryConversionPercent: number | null;
  inquiryConversionNote: string;

  founderCount: number;
  founderRemaining: number;
  founderCapacity: number;

  welcomeBackRequested: number;
  welcomeBackApproved: number;
  welcomeBackPending: number;
  welcomeBackRejected: number;

  whiteGloveRevenueCents: number;
  whiteGloveRevenueConfidence: MetricConfidence;
  whiteGloveRevenueNote: string;
  whiteGloveCustomerCount: number;

  /** Open WG checklist tasks. */
  implementationOpenTasks: number;
  /** WG customers currently in onboarding. */
  implementationWgOnboarding: number;
  implementationNote: string;

  /** Open "Go Live" checklist tasks. */
  launchGoLiveOpen: number;
  /** Relationships near launch (WG onboarding with Launch review or Go Live open). */
  launchNearCount: number;
  launchNote: string;

  /** Average days subscribe → live/active when both dates exist; null → show —. */
  avgOnboardingDays: number | null;
  avgOnboardingSampleSize: number;
  avgOnboardingNote: string;

  subscriptionGrowth: SubscriptionGrowthRow[];

  /** ARR + estimated pipeline contribution. */
  projectedArrCents: number;
  projectedArrConfidence: MetricConfidence;
  projectedArrNote: string;
  pipelineCount: number;
  pipelineValueCents: number;

  activeCustomers: number;
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function isOpenTask(t: Task): boolean {
  return t.status === "open" || t.status === "in_progress";
}

function isChecklistTask(t: Task): boolean {
  if (t.meta?.checklist === WHITE_GLOVE_CHECKLIST_MARKER) return true;
  return /White Glove implementation/i.test(t.description ?? "");
}

function isGoLiveTask(t: Task): boolean {
  return isChecklistTask(t) && /^Go Live$/i.test(t.title);
}

function isLaunchNearTask(t: Task): boolean {
  return isChecklistTask(t) && /^(Launch review|Go Live)$/i.test(t.title);
}

function isWhiteGloveInvoice(description: string): boolean {
  return /white\s*glove/i.test(description);
}

function pipelineStatusOf(r: Relationship) {
  return toPipelineStatus(normalizeRelationshipStatus(r.status));
}

function isSubscribedPlus(r: Relationship): boolean {
  return SUBSCRIBED_PLUS.has(pipelineStatusOf(r));
}

function subscribeAt(
  relationshipId: string,
  subscriptions: Subscription[],
  timeline: TimelineEvent[],
): string | null {
  const sub = subscriptions.find((s) => s.relationshipId === relationshipId);
  if (sub?.startedAt) return sub.startedAt;
  const purchased = timeline
    .filter((e) => e.relationshipId === relationshipId && e.type === "subscription_purchased")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return purchased[0]?.occurredAt ?? null;
}

function liveAt(
  relationshipId: string,
  relationship: Relationship,
  timeline: TimelineEvent[],
): string | null {
  const completed = timeline
    .filter((e) => e.relationshipId === relationshipId && e.type === "onboarding_completed")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  if (completed[0]) return completed[0].occurredAt;

  const status = pipelineStatusOf(relationship);
  if (status === "live" || status === "expansion" || status === "referral" || status === "renewal") {
    const moved = timeline
      .filter(
        (e) =>
          e.relationshipId === relationshipId &&
          e.type === "status_changed" &&
          /live|active/i.test(`${e.title} ${e.body ?? ""}`),
      )
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    if (moved[0]) return moved[0].occurredAt;
  }
  return null;
}

function daysBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Build Jennifer’s company dashboard metrics from workspace data (seed or live).
 */
export function computeBusinessDashboardMetrics(
  data: WorkspaceData,
  now = new Date("2026-07-21T12:00:00.000Z"),
): BusinessDashboardMetrics {
  const relationships = data.relationships.map((r) => ({
    ...r,
    status: normalizeRelationshipStatus(r.status),
  }));
  const subscriptions = data.subscriptions;
  const invoices = data.invoices;
  const walkthroughs = data.walkthroughs;
  const tasks = data.tasks;
  const timeline = data.timelineEvents;

  const activeSubs = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing",
  );
  const mrrFromSubs = activeSubs.reduce((sum, s) => sum + (s.mrrCents || 0), 0);
  const mrrCents = mrrFromSubs > 0 ? mrrFromSubs : data.reports.mrrCents || 0;
  const mrrConfidence: MetricConfidence =
    mrrFromSubs > 0 ? "actual" : mrrCents > 0 ? "estimate" : "empty";
  const arrCents = mrrCents * 12;

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const revenueCents = paidInvoices.reduce((sum, i) => sum + i.amountCents, 0);
  const revenueConfidence: MetricConfidence =
    paidInvoices.length > 0 ? "actual" : "empty";
  const revenueNote =
    paidInvoices.length > 0
      ? `Collected from ${paidInvoices.length} paid invoice${paidInvoices.length === 1 ? "" : "s"}`
      : "No paid invoices in store yet";

  const paying = relationships.filter((r) => isSubscribedPlus(r));
  const churned = relationships.filter((r) => pipelineStatusOf(r) === "former_customer");
  const churnBase = paying.length + churned.length;
  const churnPercent =
    churnBase > 0 ? Math.round((churned.length / churnBase) * 1000) / 10 : 0;

  const trialRels = relationships.filter((r) => pipelineStatusOf(r) === "trial");
  const trialingSubs = subscriptions.filter((s) => s.status === "trialing");
  const trialIds = new Set([
    ...trialRels.map((r) => r.id),
    ...trialingSubs.map((s) => s.relationshipId),
  ]);
  const trialCount = trialIds.size;
  const trialNote =
    trialCount === 0
      ? "No trial relationships or trialing subscriptions"
      : `${trialRels.length} in Trial · ${trialingSubs.length} trialing sub${trialingSubs.length === 1 ? "" : "s"}`;

  const completedWt = walkthroughs.filter((w) => w.status === "completed");
  const walkthroughConverted = completedWt.filter((w) => {
    const rel = relationships.find((r) => r.id === w.relationshipId);
    return rel ? isSubscribedPlus(rel) : false;
  }).length;
  const walkthroughConversionPercent =
    completedWt.length > 0
      ? Math.round((walkthroughConverted / completedWt.length) * 1000) / 10
      : null;

  const inquiryCount = relationships.length;
  const inquiryConverted = paying.length;
  const inquiryConversionPercent =
    inquiryCount > 0
      ? Math.round((inquiryConverted / inquiryCount) * 1000) / 10
      : null;

  const founders = relationships.filter((r) => r.foundingMember);
  const founderCount = founders.length;
  const founderCapacity =
    getFounderProgramCapacity() || data.founderProgram.totalSpots || 100;
  const founderRemaining = computeFounderRemaining(founderCount, founderCapacity);

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

  const wgInvoices = paidInvoices.filter((i) => isWhiteGloveInvoice(i.description));
  const whiteGloveRevenueCents = wgInvoices.reduce((sum, i) => sum + i.amountCents, 0);
  const whiteGloveCustomers = relationships.filter(
    (r) => r.onboardingType === "white_glove",
  );
  const whiteGloveRevenueConfidence: MetricConfidence =
    wgInvoices.length > 0 ? "actual" : whiteGloveCustomers.length > 0 ? "empty" : "empty";
  const whiteGloveRevenueNote =
    wgInvoices.length > 0
      ? `${wgInvoices.length} White Glove invoice${wgInvoices.length === 1 ? "" : "s"} paid`
      : whiteGloveCustomers.length > 0
        ? "White Glove customers present — no paid WG invoices yet"
        : "No White Glove purchases yet";

  const checklistOpen = tasks.filter((t) => isChecklistTask(t) && isOpenTask(t));
  const wgOnboarding = whiteGloveCustomers.filter(
    (r) => pipelineStatusOf(r) === "onboarding" || pipelineStatusOf(r) === "subscribed",
  );
  const goLiveOpen = tasks.filter((t) => isGoLiveTask(t) && isOpenTask(t));
  const nearLaunchRelIds = new Set(
    tasks
      .filter((t) => isLaunchNearTask(t) && isOpenTask(t))
      .map((t) => t.relationshipId),
  );
  // Also count WG onboarding venues even if tasks missing (near launch by stage).
  for (const r of wgOnboarding) {
    nearLaunchRelIds.add(r.id);
  }

  const onboardingDurations: number[] = [];
  for (const r of relationships) {
    const start = subscribeAt(r.id, subscriptions, timeline);
    const end = liveAt(r.id, r, timeline);
    if (!start || !end) continue;
    if (new Date(end).getTime() < new Date(start).getTime()) continue;
    onboardingDurations.push(daysBetween(start, end));
  }
  const avgOnboardingDays =
    onboardingDurations.length > 0
      ? Math.round(
          onboardingDurations.reduce((a, b) => a + b, 0) / onboardingDurations.length,
        )
      : null;

  const monthMap = new Map<string, SubscriptionGrowthRow>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, {
      key,
      label: monthLabel(key),
      newSubs: 0,
      mrrCents: 0,
    });
  }
  for (const s of subscriptions) {
    const key = monthKey(s.startedAt);
    const row = monthMap.get(key);
    if (!row) continue;
    row.newSubs += 1;
    const mrr =
      s.mrrCents > 0
        ? s.mrrCents
        : PLAN_MRR_ESTIMATE[s.planId] ?? PLAN_MRR_ESTIMATE.none;
    row.mrrCents += mrr;
  }
  const subscriptionGrowth = [...monthMap.values()];

  const pipelineRels = relationships.filter((r) => PIPELINE_OPEN.has(pipelineStatusOf(r)));
  const pipelineValueCents = pipelineRels.reduce(
    (sum, r) => sum + (PLAN_MRR_ESTIMATE[r.planId] ?? PLAN_MRR_ESTIMATE.none),
    0,
  );
  const projectedMrrCents =
    mrrCents + Math.round(pipelineValueCents * PIPELINE_CLOSE_RATE);
  const projectedArrCents = projectedMrrCents * 12;

  return {
    mrrCents,
    mrrConfidence,
    arrCents,
    arrConfidence: mrrConfidence,
    revenueCents,
    revenueConfidence,
    revenueNote,

    churnPercent,
    churnCount: churned.length,
    churnBase,
    churnNote:
      churnBase > 0
        ? `${churned.length} former · ${paying.length} subscribed+`
        : "No customers yet",

    trialCount,
    trialNote,

    walkthroughCompleted: completedWt.length,
    walkthroughConverted,
    walkthroughConversionPercent,
    walkthroughConversionNote:
      completedWt.length > 0
        ? `${walkthroughConverted} of ${completedWt.length} completed walkthroughs subscribed+`
        : "No completed walkthroughs yet",

    inquiryCount,
    inquiryConverted,
    inquiryConversionPercent,
    inquiryConversionNote:
      inquiryCount > 0
        ? `${inquiryConverted} of ${inquiryCount} relationships reached subscribed+`
        : "No relationships yet",

    founderCount,
    founderRemaining,
    founderCapacity,

    welcomeBackRequested: welcomeBack.length,
    welcomeBackApproved,
    welcomeBackPending,
    welcomeBackRejected,

    whiteGloveRevenueCents,
    whiteGloveRevenueConfidence,
    whiteGloveRevenueNote,
    whiteGloveCustomerCount: whiteGloveCustomers.length,

    implementationOpenTasks: checklistOpen.length,
    implementationWgOnboarding: wgOnboarding.length,
    implementationNote:
      wgOnboarding.length > 0 || checklistOpen.length > 0
        ? `${checklistOpen.length} open checklist tasks · ${wgOnboarding.length} WG in onboarding`
        : "No White Glove implementation in flight",

    launchGoLiveOpen: goLiveOpen.length,
    launchNearCount: nearLaunchRelIds.size,
    launchNote:
      nearLaunchRelIds.size > 0
        ? `${goLiveOpen.length} Go Live open · ${nearLaunchRelIds.size} near launch`
        : "No venues in launch pipeline",

    avgOnboardingDays,
    avgOnboardingSampleSize: onboardingDurations.length,
    avgOnboardingNote:
      onboardingDurations.length > 0
        ? `From ${onboardingDurations.length} venue${onboardingDurations.length === 1 ? "" : "s"} with subscribe → live dates`
        : "Need subscribe and live/onboarding-completed dates",

    subscriptionGrowth,

    projectedArrCents,
    projectedArrConfidence: "estimate",
    projectedArrNote: `ARR + ${Math.round(PIPELINE_CLOSE_RATE * 100)}% of open pipeline (plan MRR estimates)`,
    pipelineCount: pipelineRels.length,
    pipelineValueCents,

    activeCustomers: paying.length,
  };
}
