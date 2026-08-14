import {
  computeFounderRemaining,
  getFounderProgramCapacity,
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
  type LiveRelationshipStore,
} from "@shared/relationships";

import { seedData } from "@/lib/data/seed";
import { normalizeRelationshipStatus } from "@/lib/pipeline";
import {
  getLocalCommunicationsSync,
  getLocalTasksSync,
  getLocalTimelineSync,
  getRelationshipPatchesSync,
} from "@/lib/program3/store";
import { getTeamProfilesSync } from "@/lib/program4/store";
import { deriveSalesStage, relationshipHasOpenSupport } from "@/lib/sales-cs";
import type {
  Communication,
  FounderProgramStats,
  Notification,
  OnboardingMilestone,
  Relationship,
  ReportSnapshot,
  Subscription,
  Task,
  TeamMember,
  TimelineEvent,
  Walkthrough,
  WorkspaceData,
} from "@/lib/types";

function teamMembersFromProgram4(): TeamMember[] {
  return getTeamProfilesSync().map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.title,
    initials: m.initials,
  }));
}

/**
 * Workspace data layer — Phase 2 + Program 3 overlays.
 *
 * Reads the shared live JSONL store (written by marketing) on every call.
 * Falls back to Phase 1 seed when the live store is empty, unless USE_SEED_DATA=false.
 *
 * Program 3 patches (status moves, local timeline/comms/tasks) merge on top.
 */

function useSeedFallback(): boolean {
  const flag = process.env.USE_SEED_DATA?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no" || flag === "off") {
    return false;
  }
  return true;
}

function todayPrefix(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function computeFounderProgram(relationships: Relationship[]): FounderProgramStats {
  const founding = relationships.filter((r) => r.foundingMember);
  const welcomeBack = relationships.filter((r) => r.welcomeBackRequested);
  const capacity = getFounderProgramCapacity();
  const currentCount = founding.length;
  return {
    totalSpots: capacity,
    currentCount,
    remainingSpots: computeFounderRemaining(currentCount, capacity),
    newThisWeek: founding.filter((r) => {
      const weekAgo = Date.now() - 7 * 86_400_000;
      return new Date(r.createdAt).getTime() >= weekAgo;
    }).length,
    welcomeBackRequests: welcomeBack.length,
    pendingVerification: welcomeBack.filter((r) => r.welcomeBackVerified === "pending")
      .length,
    verified: welcomeBack.filter((r) => r.welcomeBackVerified === "verified").length,
    rejected: welcomeBack.filter((r) => r.welcomeBackVerified === "rejected").length,
    expired: welcomeBack.filter((r) => r.welcomeBackVerified === "expired").length,
  };
}

function emptyReports(): ReportSnapshot {
  return {
    founderGrowth: [],
    subscriptionGrowth: [],
    welcomeBackConversions: 0,
    welcomeBackConversionRate: 0,
    whiteGloveAdoption: 0,
    whiteGloveAdoptionRate: 0,
    walkthroughConversionRate: 0,
    mrrCents: 0,
    arrCents: 0,
    customerHealth: [],
  };
}

function toWorkspaceRelationship(
  r: LiveRelationshipStore["relationships"][number],
): Relationship {
  return {
    ...r,
    status: normalizeRelationshipStatus(r.status as Relationship["status"]),
  };
}

function applyProgram3Overlays(data: WorkspaceData): WorkspaceData {
  const patches = getRelationshipPatchesSync();
  const patchMap = new Map(patches.map((p) => [p.relationshipId, p]));

  const relationships = data.relationships.map((r) => {
    const patch = patchMap.get(r.id);
    if (!patch) {
      return { ...r, status: normalizeRelationshipStatus(r.status) };
    }
    return {
      ...r,
      status: normalizeRelationshipStatus(patch.status ?? r.status),
      currentStageLabel: patch.currentStageLabel ?? r.currentStageLabel,
      assignedTeamMemberId: patch.assignedTeamMemberId ?? r.assignedTeamMemberId,
      foundingMember:
        patch.foundingMember === true ? true : r.foundingMember,
      welcomeBackVerified: patch.welcomeBackVerified ?? r.welcomeBackVerified,
      salesStage: patch.salesStage ?? r.salesStage,
      customerSuccessStage:
        patch.customerSuccessStage ?? r.customerSuccessStage,
      lastAutoArrival:
        patch.lastAutoArrival !== undefined
          ? patch.lastAutoArrival
          : r.lastAutoArrival,
      updatedAt: patch.updatedAt ?? r.updatedAt,
    };
  });

  const localTimeline = getLocalTimelineSync().map(
    (e) =>
      ({
        id: e.id,
        relationshipId: e.relationshipId,
        type: e.type as TimelineEvent["type"],
        title: e.title,
        body: e.body,
        occurredAt: e.occurredAt,
        actorId: e.actorId,
        meta: e.meta,
      }) satisfies TimelineEvent,
  );

  const timelineIds = new Set(data.timelineEvents.map((e) => e.id));
  const timelineEvents = [
    ...data.timelineEvents,
    ...localTimeline.filter((e) => !timelineIds.has(e.id)),
  ];

  const localComms = getLocalCommunicationsSync().map(
    (c) =>
      ({
        id: c.id,
        relationshipId: c.relationshipId,
        channel: c.channel,
        subject: c.subject,
        body: c.body,
        direction: c.direction,
        occurredAt: c.occurredAt,
        actorId: c.actorId,
        authorName: c.authorName,
      }) satisfies Communication,
  );
  const commIds = new Set(data.communications.map((c) => c.id));
  const communications = [
    ...data.communications,
    ...localComms.filter((c) => !commIds.has(c.id)),
  ];

  const localTasks = getLocalTasksSync().map(
    (t) =>
      ({
        id: t.id,
        relationshipId: t.relationshipId,
        title: t.title,
        description: t.description,
        ownerId: t.ownerId,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        meta: t.meta,
      }) satisfies Task,
  );
  const localById = new Map(localTasks.map((t) => [t.id, t]));
  const seedTaskIds = new Set(data.tasks.map((t) => t.id));
  const tasks = [
    ...data.tasks.map((t) => localById.get(t.id) ?? t),
    ...localTasks.filter((t) => !seedTaskIds.has(t.id)),
  ];

  return {
    ...data,
    relationships,
    timelineEvents,
    communications,
    tasks,
    founderProgram: computeFounderProgram(relationships),
  };
}

function buildWorkspaceData(): WorkspaceData {
  const live = loadLiveStoreSync();
  const hasLive = live.relationships.length > 0;
  const seed = structuredClone(seedData);

  const roster = teamMembersFromProgram4();

  if (!hasLive && useSeedFallback()) {
    return applyProgram3Overlays({ ...seed, teamMembers: roster });
  }

  if (!hasLive) {
    return applyProgram3Overlays({
      ...seed,
      teamMembers: roster,
      relationships: [],
      timelineEvents: [],
      tasks: [],
      communications: [],
      documents: [],
      invoices: [],
      subscriptions: [],
      walkthroughs: [],
      onboardingMilestones: [],
      notifications: [],
      founderProgram: computeFounderProgram([]),
      reports: emptyReports(),
    });
  }

  const relationships = live.relationships.map(toWorkspaceRelationship);
  const mrrCents = live.subscriptions
    .filter((s) => s.status === "active" || s.status === "trialing")
    .reduce((sum, s) => sum + (s.mrrCents || 0), 0);

  return applyProgram3Overlays({
    teamMembers: roster,
    relationships,
    timelineEvents: live.timelineEvents as TimelineEvent[],
    tasks: (live.tasks ?? []).map(
      (t) =>
        ({
          id: t.id,
          relationshipId: t.relationshipId,
          title: t.title,
          description: t.description,
          ownerId: t.ownerId,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
          meta: t.meta,
        }) satisfies Task,
    ),
    communications: live.communications as Communication[],
    documents: [],
    invoices: [],
    subscriptions: live.subscriptions as Subscription[],
    walkthroughs: live.walkthroughs as Walkthrough[],
    onboardingMilestones: [] as OnboardingMilestone[],
    notifications: live.notifications as Notification[],
    founderProgram: computeFounderProgram(relationships),
    reports: {
      ...emptyReports(),
      mrrCents,
      arrCents: mrrCents * 12,
      whiteGloveAdoption: relationships.filter((r) => r.onboardingType === "white_glove")
        .length,
      welcomeBackConversions: relationships.filter(
        (r) => r.welcomeBackVerified === "verified",
      ).length,
    },
  });
}

export function getData(): WorkspaceData {
  return buildWorkspaceData();
}

export function resetData(): void {
  // Seed-only reset for tests; live store is the durable source of truth.
}

export function getTeamMembers(): TeamMember[] {
  return getData().teamMembers;
}

export function getTeamMember(id: string): TeamMember | undefined {
  return getData().teamMembers.find((m) => m.id === id);
}

export function getRelationships(): Relationship[] {
  return [...getData().relationships].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getRelationship(id: string): Relationship | undefined {
  return getData().relationships.find((r) => r.id === id);
}

export function getTimelineForRelationship(relationshipId: string): TimelineEvent[] {
  return getData()
    .timelineEvents.filter((e) => e.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function getTasks(opts?: {
  relationshipId?: string;
  openOnly?: boolean;
}): Task[] {
  return getData()
    .tasks.filter((t) => {
      if (opts?.relationshipId && t.relationshipId !== opts.relationshipId) return false;
      if (opts?.openOnly && (t.status === "completed" || t.status === "cancelled")) return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getCommunications(opts?: { relationshipId?: string }): Communication[] {
  return getData()
    .communications.filter(
      (c) => !opts?.relationshipId || c.relationshipId === opts.relationshipId,
    )
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function getWalkthroughs(opts?: {
  status?: Walkthrough["status"] | Walkthrough["status"][];
}): Walkthrough[] {
  const statuses = opts?.status
    ? Array.isArray(opts.status)
      ? opts.status
      : [opts.status]
    : null;
  return getData()
    .walkthroughs.filter((w) => !statuses || statuses.includes(w.status))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

export function getOnboardingMilestones(relationshipId?: string): OnboardingMilestone[] {
  return getData()
    .onboardingMilestones.filter((m) => !relationshipId || m.relationshipId === relationshipId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getWhiteGloveRelationships(): Relationship[] {
  return getRelationships().filter((r) => r.onboardingType === "white_glove");
}

export function getNotifications(opts?: { unreadOnly?: boolean }): Notification[] {
  return getData()
    .notifications.filter((n) => !opts?.unreadOnly || !n.read)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Vendor + client Support inbox (not venue Relationship.openFeedbackItems). */
export function getSupportInboxItems(opts?: {
  surface?: "vendor" | "client" | "all";
  status?: "open" | "resolved" | "all";
}) {
  const live = hasLiveRelationshipsSync() ? loadLiveStoreSync() : null;
  const items = live?.supportInboxItems ?? [];
  const surface = opts?.surface ?? "all";
  const status = opts?.status ?? "open";
  return [...items]
    .filter((i) => (surface === "all" ? true : i.surface === surface))
    .filter((i) => (status === "all" ? true : i.status === status))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function getFounderProgram(): FounderProgramStats {
  return getData().founderProgram;
}

export function getFoundingRelationships(): Relationship[] {
  return getRelationships().filter((r) => r.foundingMember);
}

export function getReports(): ReportSnapshot {
  return getData().reports;
}

export function getOpenTaskCount(relationshipId: string): number {
  return getTasks({ relationshipId, openOnly: true }).length;
}

export type DashboardBuckets = {
  newInquiries: Relationship[];
  newWalkthroughRequests: Relationship[];
  newSubscribers: Relationship[];
  whiteGlovePurchases: Relationship[];
  welcomeBackRequests: Relationship[];
  /** Sales stage Responded — waiting on Hello to Cheers follow-up. */
  respondedNeedsFollowUp: Relationship[];
  upcomingWalkthroughs: Walkthrough[];
  upcomingOnboardingSessions: Relationship[];
  founderProgress: FounderProgramStats;
  supportRequests: Relationship[];
  recentActivity: TimelineEvent[];
  unreadNotifications: Notification[];
};

/** Today's activity buckets — uses calendar today for live data. */
export function getDashboardBuckets(): DashboardBuckets {
  const snapshot = getData();
  const day = todayPrefix();
  const relationships = getRelationships();

  const newInquiries = relationships.filter(
    (r) => r.status === "inquiry" && r.createdAt.startsWith(day),
  );

  const newWalkthroughRequests = relationships.filter((r) =>
    getTimelineForRelationship(r.id).some(
      (e) =>
        (e.type === "walkthrough_requested" || e.type === "walkthrough_scheduled") &&
        e.occurredAt.startsWith(day),
    ),
  );

  const newSubscribers = relationships.filter(
    (r) =>
      (r.status === "subscribed" ||
        r.status === "onboarding" ||
        r.status === "live" ||
        r.status === "active_customer") &&
      snapshot.subscriptions.some(
        (s) => s.relationshipId === r.id && s.startedAt.startsWith(day),
      ),
  );

  const whiteGlovePurchases = getWhiteGloveRelationships().filter((r) =>
    getTimelineForRelationship(r.id).some((e) => e.type === "white_glove_purchased"),
  );

  const welcomeBackRequests = relationships.filter(
    (r) => r.welcomeBackRequested && r.welcomeBackVerified === "pending",
  );

  const respondedNeedsFollowUp = relationships
    .filter((r) => deriveSalesStage(r) === "responded")
    .sort((a, b) => {
      const aAt = a.lastInboundAt || a.lastContactAt;
      const bAt = b.lastInboundAt || b.lastContactAt;
      return new Date(bAt).getTime() - new Date(aAt).getTime();
    });

  const upcomingWalkthroughs = getWalkthroughs({ status: "upcoming" });

  const upcomingOnboardingSessions = relationships.filter(
    (r) =>
      r.onboardingType === "white_glove" &&
      r.status === "onboarding" &&
      Boolean(r.nextMilestoneAt),
  );

  const supportRequests = relationships.filter(relationshipHasOpenSupport);

  const recentActivity = [...snapshot.timelineEvents]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 12);

  return {
    newInquiries,
    newWalkthroughRequests: [...new Map(newWalkthroughRequests.map((r) => [r.id, r])).values()],
    newSubscribers,
    whiteGlovePurchases,
    welcomeBackRequests,
    respondedNeedsFollowUp,
    upcomingWalkthroughs,
    upcomingOnboardingSessions,
    founderProgress: getFounderProgram(),
    supportRequests,
    recentActivity,
    unreadNotifications: getNotifications({ unreadOnly: true }),
  };
}

export function getDocuments(relationshipId: string) {
  return getData()
    .documents.filter((d) => d.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export function getInvoices(relationshipId: string) {
  return getData()
    .invoices.filter((i) => i.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
}

export function getSubscriptions(relationshipId: string) {
  return getData()
    .subscriptions.filter((s) => s.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function liveStoreHasData(): boolean {
  return hasLiveRelationshipsSync();
}
