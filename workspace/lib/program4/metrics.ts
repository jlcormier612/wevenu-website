import type {
  ReportSnapshot,
  WorkspaceData,
} from "@/lib/types";
import { normalizeRelationshipStatus } from "@/lib/pipeline";
import {
  computeFounderRemaining,
  getFounderProgramCapacity,
} from "@shared/relationships";

export type BusinessMetrics = {
  mrrCents: number;
  arrCents: number;
  founderCount: number;
  founderRemaining: number;
  welcomeBackTotal: number;
  welcomeBackPending: number;
  welcomeBackVerified: number;
  welcomeBackRejected: number;
  whiteGloveCount: number;
  whiteGlovePercent: number;
  walkthroughConversionPercent: number;
  walkthroughCompleted: number;
  walkthroughConverted: number;
  revenueByPlan: { planId: string; planName: string; mrrCents: number; count: number }[];
  revenueByMonth: { label: string; mrrCents: number; newSubs: number }[];
  churnPercent: number;
  churnCount: number;
  activeCustomers: number;
  pipelineValueCents: number;
  pipelineCount: number;
  forecastMrrCents: number;
  forecastNote: string;
  collectionsDueCents: number;
  collectionsOverdueCents: number;
  collectionsNote: string;
  growthPercent: number;
  growthNote: string;
  health: ReportSnapshot["customerHealth"];
};

const PLAN_MRR_ESTIMATE: Record<string, number> = {
  gather: 14900,
  celebrate: 24900,
  flourish: 39900,
  none: 24900,
};

const PIPELINE_STATUSES = new Set([
  "inquiry",
  "walkthrough_requested",
  "walkthrough_scheduled",
  "walkthrough_completed",
  "trial",
]);

const ACTIVE_STATUSES = new Set([
  "subscribed",
  "onboarding",
  "live",
  "active_customer",
  "expansion",
  "referral",
  "renewal",
]);

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function computeBusinessMetrics(data: WorkspaceData): BusinessMetrics {
  const relationships = data.relationships.map((r) => ({
    ...r,
    status: normalizeRelationshipStatus(r.status),
  }));
  const subscriptions = data.subscriptions;
  const walkthroughs = data.walkthroughs;
  const invoices = data.invoices;
  const reports = data.reports;

  const activeSubs = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing",
  );
  const mrrCents =
    activeSubs.reduce((sum, s) => sum + (s.mrrCents || 0), 0) || reports.mrrCents;
  const arrCents = mrrCents * 12;

  const founders = relationships.filter((r) => r.foundingMember);
  const founderCount = founders.length || data.founderProgram.currentCount;
  const capacity = getFounderProgramCapacity() || data.founderProgram.totalSpots || 100;
  const founderRemaining = computeFounderRemaining(founderCount, capacity);

  const welcomeBack = relationships.filter((r) => r.welcomeBackRequested);
  const welcomeBackPending = welcomeBack.filter((r) => r.welcomeBackVerified === "pending").length;
  const welcomeBackVerified = welcomeBack.filter((r) => r.welcomeBackVerified === "verified").length;
  const welcomeBackRejected = welcomeBack.filter((r) => r.welcomeBackVerified === "rejected").length;

  const paying = relationships.filter((r) => ACTIVE_STATUSES.has(r.status));
  const whiteGlove = relationships.filter((r) => r.onboardingType === "white_glove");
  const whiteGlovePercent =
    paying.length > 0 ? Math.round((whiteGlove.length / paying.length) * 100) : 0;

  const completedWt = walkthroughs.filter((w) => w.status === "completed");
  const convertedFromWt = completedWt.filter((w) => {
    const rel = relationships.find((r) => r.id === w.relationshipId);
    return rel && ACTIVE_STATUSES.has(rel.status);
  });
  const walkthroughConversionPercent =
    completedWt.length > 0
      ? Math.round((convertedFromWt.length / completedWt.length) * 100)
      : Math.round((reports.walkthroughConversionRate || 0) * 100);

  const planMap = new Map<string, { planName: string; mrrCents: number; count: number }>();
  for (const s of activeSubs) {
    const row = planMap.get(s.planId) ?? {
      planName: s.planName,
      mrrCents: 0,
      count: 0,
    };
    row.mrrCents += s.mrrCents;
    row.count += 1;
    planMap.set(s.planId, row);
  }
  const revenueByPlan = [...planMap.entries()]
    .map(([planId, v]) => ({ planId, ...v }))
    .sort((a, b) => b.mrrCents - a.mrrCents);

  // Last 6 months of new subscription MRR
  const monthMap = new Map<string, { label: string; mrrCents: number; newSubs: number }>();
  const now = new Date("2026-07-21T12:00:00.000Z");
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, {
      label: d.toLocaleString("en-US", { month: "short" }),
      mrrCents: 0,
      newSubs: 0,
    });
  }
  for (const s of subscriptions) {
    const key = monthKey(s.startedAt);
    const row = monthMap.get(key);
    if (!row) continue;
    row.newSubs += 1;
    if (s.status === "active" || s.status === "trialing") {
      row.mrrCents += s.mrrCents;
    } else {
      // historical start value — use plan estimate if cancelled
      row.mrrCents += s.mrrCents || PLAN_MRR_ESTIMATE[s.planId] || 0;
    }
  }
  const revenueByMonth = [...monthMap.values()];

  const churned = relationships.filter((r) => r.status === "former_customer");
  const activeCustomers = paying.length;
  const churnBase = activeCustomers + churned.length;
  const churnPercent =
    churnBase > 0 ? Math.round((churned.length / churnBase) * 1000) / 10 : 0;

  const pipelineRels = relationships.filter((r) => PIPELINE_STATUSES.has(r.status));
  const pipelineValueCents = pipelineRels.reduce((sum, r) => {
    return sum + (PLAN_MRR_ESTIMATE[r.planId] ?? PLAN_MRR_ESTIMATE.none);
  }, 0);

  // Simple forecast: current MRR + 60% of pipeline closing next quarter
  const forecastMrrCents = mrrCents + Math.round(pipelineValueCents * 0.6);

  const due = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const collectionsDueCents = due.reduce((s, i) => s + i.amountCents, 0);
  const collectionsOverdueCents = overdue.reduce((s, i) => s + i.amountCents, 0);

  // MoM growth from revenueByMonth new MRR
  const months = revenueByMonth;
  const last = months[months.length - 1]?.mrrCents ?? 0;
  const prev = months[months.length - 2]?.mrrCents ?? 0;
  const growthPercent =
    prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : last > 0 ? 100 : 0;

  return {
    mrrCents,
    arrCents,
    founderCount,
    founderRemaining,
    welcomeBackTotal: welcomeBack.length || data.founderProgram.welcomeBackRequests,
    welcomeBackPending: welcomeBackPending || data.founderProgram.pendingVerification,
    welcomeBackVerified: welcomeBackVerified || data.founderProgram.verified,
    welcomeBackRejected: welcomeBackRejected || data.founderProgram.rejected || 0,
    whiteGloveCount: whiteGlove.length,
    whiteGlovePercent,
    walkthroughConversionPercent,
    walkthroughCompleted: completedWt.length,
    walkthroughConverted: convertedFromWt.length,
    revenueByPlan,
    revenueByMonth,
    churnPercent,
    churnCount: churned.length,
    activeCustomers,
    pipelineValueCents,
    pipelineCount: pipelineRels.length,
    forecastMrrCents,
    forecastNote: "MRR + 60% of open pipeline (placeholder close rate)",
    collectionsDueCents,
    collectionsOverdueCents,
    collectionsNote:
      invoices.length === 0
        ? "Placeholder — invoice store empty in live mode"
        : `${due.length} open · ${overdue.length} overdue`,
    growthPercent,
    growthNote: "New subscription MRR this month vs prior",
    health:
      reports.customerHealth.length > 0
        ? reports.customerHealth
        : ([
            "excellent",
            "good",
            "needs_attention",
            "at_risk",
          ] as const).map((health) => ({
            health,
            count: relationships.filter((r) => r.health === health).length,
          })),
  };
}

