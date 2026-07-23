import type {
  Communication,
  OnboardingMilestone,
  Relationship,
  Task,
  TimelineEvent,
  WorkspaceData,
} from "@/lib/types";
import { normalizeRelationshipStatus } from "@/lib/pipeline";

import type { LuvDraftKind, LuvInsight, LuvSeverity } from "./types";

const MS_DAY = 86_400_000;

const POSITIVE_REPLY_RE =
  /\b(loved|love|excited|looking forward|thank you|thanks|perfect|wonderful|great|yes please|sounds great|appreciate)\b/i;

const CORPORATE_RE =
  /\b(corporate|company event|offsite|retreat|team building|client event|holiday party)\b/i;

const IMPROVING_RE =
  /\b(resolved|fixed|working now|much better|thank you for fixing|all set|cleared up)\b/i;

const WELCOME_EMAIL_RE =
  /\b(welcome email|founder welcome|welcome to hello to cheers|you.?re a founding member)\b/i;

const IMPL_TASK_RE = /^(Website review|Launch review|Go Live)$/i;

const CHECKLIST_META = "white_glove_implementation";

function daysBetween(iso: string, now: Date): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / MS_DAY);
}

function pipelineStatus(r: Relationship) {
  return normalizeRelationshipStatus(r.status);
}

function severityRank(s: LuvSeverity): number {
  switch (s) {
    case "urgent":
      return 4;
    case "attention":
      return 3;
    case "suggested":
      return 2;
    default:
      return 1;
  }
}

function forRelationship<T extends { relationshipId: string }>(
  items: T[],
  id: string,
): T[] {
  return items.filter((i) => i.relationshipId === id);
}

function latestInbound(comms: Communication[]): Communication | undefined {
  return [...comms]
    .filter((c) => c.direction === "inbound")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
}

function latestOutbound(comms: Communication[]): Communication | undefined {
  return [...comms]
    .filter((c) => c.direction === "outbound")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
}

function hasEventType(events: TimelineEvent[], type: TimelineEvent["type"]): boolean {
  return events.some((e) => e.type === type);
}

function address(actorFirstName: string | undefined, line: string): string {
  const name = actorFirstName?.trim();
  if (!name) return line;
  // Avoid double-prefixing if caller already addressed.
  if (line.startsWith(`${name},`) || line.startsWith(`${name} —`)) return line;
  return `${name}, ${line}`;
}

function isOpenTask(t: Task): boolean {
  return t.status === "open" || t.status === "in_progress";
}

function isChecklistTask(t: Task): boolean {
  return t.meta?.checklist === CHECKLIST_META || /White Glove implementation/i.test(t.description ?? "");
}

function kickoffMilestone(milestones: OnboardingMilestone[]) {
  return milestones.find((m) => /kickoff/i.test(m.title));
}

function kickoffIncomplete(
  relationship: Relationship,
  events: TimelineEvent[],
  milestones: OnboardingMilestone[],
): boolean {
  if (relationship.onboardingType !== "white_glove") return false;
  const status = pipelineStatus(relationship);
  if (status !== "onboarding" && status !== "subscribed" && status !== "white_glove_implementation") return false;

  const km = kickoffMilestone(milestones);
  if (km && km.status !== "completed") return true;

  if (!hasEventType(events, "kickoff_scheduled") && !hasEventType(events, "onboarding_completed")) {
    return true;
  }

  if (
    km?.status === "pending" ||
    km?.status === "in_progress" ||
    (relationship.nextMilestone && /kickoff/i.test(relationship.nextMilestone))
  ) {
    return true;
  }

  return false;
}

/** Days overdue for kickoff (positive = past due). Null if not applicable / not overdue. */
function kickoffOverdueDays(
  relationship: Relationship,
  events: TimelineEvent[],
  milestones: OnboardingMilestone[],
  now: Date,
): number | null {
  if (!kickoffIncomplete(relationship, events, milestones)) return null;

  const km = kickoffMilestone(milestones);
  const dueIso =
    km?.dueAt ??
    (relationship.nextMilestone && /kickoff/i.test(relationship.nextMilestone)
      ? relationship.nextMilestoneAt
      : undefined);

  if (!dueIso) return null;
  const days = -Math.ceil(
    (new Date(dueIso).getTime() - now.getTime()) / MS_DAY,
  );
  // days > 0 means due date is in the past.
  return days > 0 ? days : null;
}

function hasWelcomeEmailAfterSubscribe(
  events: TimelineEvent[],
  subscribeAt: string | undefined,
): boolean {
  const after = subscribeAt ? new Date(subscribeAt).getTime() : 0;
  return events.some((e) => {
    if (e.type !== "email_sent") return false;
    const at = new Date(e.occurredAt).getTime();
    if (Number.isNaN(at) || at < after - 60_000) return false;
    const template = String(e.meta?.template_id ?? e.meta?.templateId ?? "");
    if (template === "welcome" || template === "founder_welcome") return true;
    return WELCOME_EMAIL_RE.test(`${e.title} ${e.body ?? ""}`);
  });
}

function subscribeMoment(events: TimelineEvent[], relationship: Relationship): string | undefined {
  const purchased = events
    .filter((e) => e.type === "subscription_purchased")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
  return purchased?.occurredAt ?? relationship.createdAt;
}

function findWhiteGlovePeer(
  relationship: Relationship,
  all: Relationship[],
): Relationship | undefined {
  if (relationship.onboardingType !== "self_guided") return undefined;
  if (!relationship.planId || relationship.planId === "none") return undefined;

  const status = pipelineStatus(relationship);
  if (
    status !== "subscribed" &&
    status !== "onboarding" &&
    status !== "live" &&
    status !== "active" &&
    status !== "reactivated" &&
    status !== "white_glove_implementation" &&
    status !== "support" &&
    status !== "expansion"
  ) {
    return undefined;
  }

  return all.find((peer) => {
    if (peer.id === relationship.id) return false;
    if (peer.planId !== relationship.planId) return false;
    if (peer.onboardingType !== "white_glove") return false;
    const peerStatus = pipelineStatus(peer);
    if (
      peerStatus !== "live" &&
      peerStatus !== "active" &&
      peerStatus !== "reactivated" &&
      peerStatus !== "onboarding" &&
      peerStatus !== "white_glove_implementation" &&
      peerStatus !== "expansion" &&
      peerStatus !== "subscribed"
    ) {
      return false;
    }
    return peer.health === "excellent" || peer.health === "good";
  });
}

function pricingViewCount(events: TimelineEvent[]): number {
  return events.filter((e) => e.type === "pricing_viewed").length;
}

function renewalWindowDays(relationship: Relationship, now: Date): number | null {
  const status = pipelineStatus(relationship);
  if (status === "renewal") return 0;
  if (
    relationship.nextMilestoneAt &&
    /renewal|check-?in|90-day/i.test(relationship.nextMilestone ?? "")
  ) {
    return Math.ceil(
      (new Date(relationship.nextMilestoneAt).getTime() - now.getTime()) / MS_DAY,
    );
  }
  if (status === "live" || status === "active" || status === "reactivated" || status === "expansion") {
    const created = new Date(relationship.createdAt);
    const anniversary = new Date(created);
    anniversary.setFullYear(anniversary.getFullYear() + 1);
    const days = Math.ceil((anniversary.getTime() - now.getTime()) / MS_DAY);
    if (days > 0 && days <= 60) return days;
  }
  return null;
}

function buildInsight(partial: Omit<LuvInsight, "priority"> & { priority?: number }): LuvInsight {
  const base = partial.priority ?? severityRank(partial.severity) * 10;
  return { ...partial, priority: base };
}

export type InsightComputeOpts = {
  now?: Date;
  dismissedIds?: Set<string>;
  /** Acting user's first name for addressed copy ("Jennifer, …"). */
  actorFirstName?: string;
  /** Full workspace relationships — needed for peer similarity. */
  allRelationships?: Relationship[];
};

/** Compute proactive insights for one relationship. */
export function computeRelationshipInsights(
  relationship: Relationship,
  data: Pick<
    WorkspaceData,
    "timelineEvents" | "communications" | "tasks" | "walkthroughs" | "onboardingMilestones"
  >,
  opts?: InsightComputeOpts,
): LuvInsight[] {
  const now = opts?.now ?? new Date();
  const dismissed = opts?.dismissedIds ?? new Set<string>();
  const actor = opts?.actorFirstName;
  const id = relationship.id;
  const venue = relationship.venue.name;
  const events = forRelationship(data.timelineEvents, id);
  const comms = forRelationship(data.communications, id);
  const tasks = forRelationship(data.tasks, id);
  const walkthroughs = forRelationship(data.walkthroughs, id);
  const milestones = forRelationship(data.onboardingMilestones, id);
  const status = pipelineStatus(relationship);
  const peers = opts?.allRelationships ?? [];
  const insights: LuvInsight[] = [];

  const push = (insight: LuvInsight) => {
    if (!dismissed.has(insight.id)) insights.push(insight);
  };

  // —— Welcome / founder email missing after subscribe ——
  if (
    (status === "subscribed" || status === "onboarding" || status === "live") &&
    (hasEventType(events, "subscription_purchased") ||
      status === "subscribed" ||
      relationship.foundingMember)
  ) {
    const subscribedAt = subscribeMoment(events, relationship);
    const daysSinceSub = subscribedAt ? daysBetween(subscribedAt, now) : 0;
    if (
      daysSinceSub <= 21 &&
      !hasWelcomeEmailAfterSubscribe(events, subscribedAt) &&
      status !== "live"
    ) {
      const kind = relationship.foundingMember ? "Founder Welcome" : "Welcome";
      push(
        buildInsight({
          id: `ins_welcome_${id}`,
          type: "welcome_missing",
          relationshipId: id,
          venueName: venue,
          message: address(
            actor,
            `this venue hasn't received their ${kind} email yet.`,
          ),
          detail: "I suggest sending it today — first impressions matter.",
          severity: daysSinceSub >= 1 ? "attention" : "suggested",
          actions: ["send_email", "draft", "create_task", "dismiss"],
          primaryAction: "send_email",
          draftKind: "welcome",
          priority: 36,
          meta: { daysSinceSubscribe: daysSinceSub, founding: relationship.foundingMember },
        }),
      );
    }
  }

  // —— Welcome Back pending ——
  if (relationship.welcomeBackRequested && relationship.welcomeBackVerified === "pending") {
    push(
      buildInsight({
        id: `ins_wb_${id}`,
        type: "welcome_back",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `they asked for Welcome Back pricing — verify eligibility when you have a moment.`,
        ),
        detail: "Approve confirms Founding pricing on this Relationship.",
        severity: "attention",
        actions: ["verify_welcome_back", "draft", "create_task", "dismiss"],
        primaryAction: "verify_welcome_back",
        draftKind: "welcome_back",
        priority: 34,
      }),
    );
  }

  // —— Kickoff overdue vs incomplete ——
  const overdueDays = kickoffOverdueDays(relationship, events, milestones, now);
  if (overdueDays !== null) {
    push(
      buildInsight({
        id: `ins_kickoff_overdue_${id}`,
        type: "kickoff_overdue",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `their kickoff call is overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}.`,
        ),
        detail: "White Glove works best when kickoff stays on the calendar.",
        severity: overdueDays >= 3 ? "urgent" : "attention",
        actions: ["draft", "create_task", "dismiss"],
        primaryAction: "draft",
        draftKind: "white_glove_kickoff",
        priority: 40 + Math.min(overdueDays, 10),
        meta: { overdueDays },
      }),
    );
  } else if (kickoffIncomplete(relationship, events, milestones)) {
    const scheduled = hasEventType(events, "kickoff_scheduled");
    push(
      buildInsight({
        id: `ins_wg_kickoff_${id}`,
        type: "white_glove_kickoff",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          scheduled
            ? `White Glove kickoff is on the books but not completed yet.`
            : `this White Glove customer still needs a kickoff scheduled.`,
        ),
        detail: relationship.nextMilestone ?? undefined,
        severity: "attention",
        actions: ["draft", "create_task", "dismiss"],
        primaryAction: "draft",
        draftKind: "white_glove_kickoff",
        priority: 32,
      }),
    );
  }

  // —— Stale / open White Glove checklist → Launch Checklist ——
  if (relationship.onboardingType === "white_glove") {
    const checklistOpen = tasks.filter((t) => isChecklistTask(t) && isOpenTask(t));
    const staleOrOverdue = checklistOpen.filter((t) => {
      const overdue =
        t.dueDate < now.toISOString().slice(0, 10) && isOpenTask(t);
      const stale = daysBetween(t.createdAt, now) >= 3;
      return overdue || stale;
    });
    if (
      checklistOpen.length > 0 &&
      (staleOrOverdue.length > 0 ||
        kickoffIncomplete(relationship, events, milestones) ||
        overdueDays !== null)
    ) {
      push(
        buildInsight({
          id: `ins_launch_checklist_${id}`,
          type: "launch_checklist",
          relationshipId: id,
          venueName: venue,
          message: address(actor, `I suggest sending the Launch Checklist today.`),
          detail: `${checklistOpen.length} implementation step${checklistOpen.length === 1 ? "" : "s"} still open.`,
          severity: staleOrOverdue.length > 0 ? "attention" : "suggested",
          actions: ["draft", "create_task", "dismiss"],
          primaryAction: "draft",
          draftKind: "launch_checklist",
          priority: 30,
          meta: { openChecklist: checklistOpen.length, stale: staleOrOverdue.length },
        }),
      );
    }

    // Waiting on implementation (Website / Launch / Go Live)
    const implOpen = checklistOpen.filter((t) => IMPL_TASK_RE.test(t.title));
    if (implOpen.length > 0) {
      const titles = implOpen.map((t) => t.title).join(", ");
      push(
        buildInsight({
          id: `ins_impl_${id}`,
          type: "implementation_waiting",
          relationshipId: id,
          venueName: venue,
          message: address(actor, `they're waiting on implementation documents.`),
          detail: `Open: ${titles}.`,
          severity: "suggested",
          actions: ["create_task", "draft", "dismiss"],
          primaryAction: "create_task",
          draftKind: "follow_up",
          priority: 27,
          meta: { implTasks: implOpen.length },
        }),
      );
    }
  }

  // —— Similar venue → recommend White Glove ——
  const peer = findWhiteGlovePeer(relationship, peers);
  if (peer) {
    push(
      buildInsight({
        id: `ins_similar_wg_${id}`,
        type: "recommend_white_glove",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `this looks similar to ${peer.venue.name}. Recommend White Glove.`,
        ),
        detail: `Both on ${relationship.planName} — guided onboarding settled ${peer.venue.name} in beautifully.`,
        severity: "suggested",
        actions: ["draft", "create_task", "dismiss"],
        primaryAction: "draft",
        draftKind: "white_glove_recommend",
        priority: 22,
        meta: { peerId: peer.id, peerName: peer.venue.name },
      }),
    );
  }

  // —— Pricing engagement (only with real signal) ——
  const views = pricingViewCount(events);
  if (views >= 2 && (status === "subscribed" || status === "onboarding" || status === "walkthrough_completed" || status === "trial")) {
    push(
      buildInsight({
        id: `ins_pricing_${id}`,
        type: "pricing_engagement",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `they viewed pricing ${views} times before ${status === "subscribed" || status === "onboarding" ? "subscribing" : "moving forward"}.`,
        ),
        detail: "Intent was clear — keep the path warm.",
        severity: "info",
        actions: ["dismiss"],
        priority: 12,
        meta: { pricingViews: views },
      }),
    );
  }

  // —— Walkthrough completed, no meaningful follow-up ——
  const completedWt = walkthroughs
    .filter((w) => w.status === "completed")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0];
  const walkthroughCompletedEvent = events
    .filter((e) => e.type === "walkthrough_completed")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];

  const wtAt = completedWt?.scheduledAt ?? walkthroughCompletedEvent?.occurredAt;
  if (
    wtAt &&
    (status === "walkthrough_completed" ||
      status === "walkthrough_scheduled" ||
      Boolean(walkthroughCompletedEvent))
  ) {
    const days = daysBetween(wtAt, now);
    const outboundAfter = latestOutbound(comms);
    const followedUp =
      outboundAfter && new Date(outboundAfter.occurredAt).getTime() > new Date(wtAt).getTime();
    if (days >= 2 && !followedUp && status !== "subscribed" && status !== "live" && status !== "onboarding") {
      push(
        buildInsight({
          id: `ins_wt_followup_${id}`,
          type: "walkthrough_followup",
          relationshipId: id,
          venueName: venue,
          message: address(
            actor,
            `there's been no follow-up after the walkthrough (${days} day${days === 1 ? "" : "s"}).`,
          ),
          detail: "A Celebrate proposal or short next-step note would land well.",
          severity: days >= 5 ? "attention" : "suggested",
          actions: ["draft", "send_email", "create_task", "dismiss"],
          primaryAction: "draft",
          draftKind: "follow_up",
          meta: { daysSinceWalkthrough: days },
          priority: 28,
        }),
      );
    }
  }

  // —— Positive inbound reply ——
  const inbound = latestInbound(comms);
  if (inbound && POSITIVE_REPLY_RE.test(`${inbound.subject} ${inbound.body}`)) {
    const days = daysBetween(inbound.occurredAt, now);
    if (days <= 14) {
      push(
        buildInsight({
          id: `ins_positive_${id}_${inbound.id}`,
          type: "positive_reply",
          relationshipId: id,
          venueName: venue,
          message: address(actor, `they replied warmly — good moment to advance.`),
          detail: inbound.subject,
          severity: "suggested",
          actions: ["draft", "dismiss"],
          primaryAction: "draft",
          draftKind: "follow_up",
        }),
      );
    }
  }

  // —— Corporate / expansion opportunity ——
  const corpus = [
    relationship.notes ?? "",
    ...comms.map((c) => `${c.subject} ${c.body}`),
    ...events.map((e) => `${e.title} ${e.body ?? ""}`),
  ].join("\n");
  if (CORPORATE_RE.test(corpus) && (status === "live" || status === "expansion" || status === "subscribed")) {
    push(
      buildInsight({
        id: `ins_corp_${id}`,
        type: "opportunity",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `they mentioned corporate events — an expansion conversation fits.`,
        ),
        detail: "Multi-event workflows could serve them next season.",
        severity: "suggested",
        actions: ["draft", "create_task", "dismiss"],
        primaryAction: "draft",
        draftKind: "email",
      }),
    );
  }

  // —— Expansion-ready live accounts ——
  if (
    (status === "live" || status === "expansion") &&
    (relationship.health === "excellent" || relationship.health === "good") &&
    (relationship.planId === "flourish" || relationship.planId === "celebrate")
  ) {
    const daysSinceContact = daysBetween(relationship.lastContactAt, now);
    if (daysSinceContact >= 2) {
      push(
        buildInsight({
          id: `ins_expand_${id}`,
          type: "expansion",
          relationshipId: id,
          venueName: venue,
          message: address(
            actor,
            `${venue} looks ready for an expansion conversation.`,
          ),
          detail: `${relationship.planName} · ${relationship.health.replace("_", " ")} health`,
          severity: "suggested",
          actions: ["draft", "create_task", "dismiss"],
          primaryAction: "draft",
          draftKind: "email",
          priority: 18,
        }),
      );
    }
  }

  // —— Support sentiment ——
  if (relationship.supportOpenCount > 0 || status === "support") {
    const supportComms = comms.filter((c) => c.channel === "support" || /support|portal|rsvp/i.test(c.subject));
    const improving = supportComms.some((c) => IMPROVING_RE.test(c.body));
    if (improving) {
      push(
        buildInsight({
          id: `ins_support_ok_${id}`,
          type: "support_improving",
          relationshipId: id,
          venueName: venue,
          message: address(actor, `support sentiment is improving — no action needed.`),
          severity: "info",
          actions: ["dismiss"],
        }),
      );
    } else {
      push(
        buildInsight({
          id: `ins_support_open_${id}`,
          type: "support_open",
          relationshipId: id,
          venueName: venue,
          message: address(actor, `there's an open support thread — keep them close.`),
          detail: relationship.nextMilestone ?? undefined,
          severity: "attention",
          actions: ["draft", "create_task", "dismiss"],
          primaryAction: "draft",
          draftKind: "support",
          priority: 29,
        }),
      );
    }
  }

  // —— Silence / last contact gap ——
  const silenceDays = daysBetween(relationship.lastContactAt, now);
  if (silenceDays >= 7 && status !== "inquiry") {
    push(
      buildInsight({
        id: `ins_silence_${id}`,
        type: "silence",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `${venue} has gone ${silenceDays} days without a response.`,
        ),
        severity: silenceDays >= 30 ? "urgent" : "attention",
        actions: ["draft", "send_email", "create_task", "dismiss"],
        primaryAction: "draft",
        draftKind: status === "former_customer" ? "referral" : "follow_up",
        meta: { silenceDays },
        priority: 25 + Math.min(silenceDays, 40),
      }),
    );
  }

  // —— Renewal window ——
  const renewalDays = renewalWindowDays(relationship, now);
  if (renewalDays !== null && renewalDays >= 0 && renewalDays <= 60) {
    push(
      buildInsight({
        id: `ins_renewal_${id}`,
        type: "renewal_checkin",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          renewalDays === 0
            ? `renewal is here — prepare the check-in.`
            : `renewal is about ${renewalDays} days out — prepare a check-in.`,
        ),
        severity: renewalDays <= 45 ? "suggested" : "info",
        actions: ["draft", "create_task", "dismiss"],
        primaryAction: "draft",
        draftKind: "renewal",
        meta: { renewalDays },
      }),
    );
  }

  // —— Former customer warmth ——
  if (status === "former_customer") {
    push(
      buildInsight({
        id: `ins_former_${id}`,
        type: "referral",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `this is a former customer — the door is still open for a warm check-in.`,
        ),
        severity: "info",
        actions: ["draft", "dismiss"],
        primaryAction: "draft",
        draftKind: "referral",
      }),
    );
  }

  // —— New inquiry / walkthrough requested ——
  if (status === "inquiry" || status === "walkthrough_requested") {
    const days = daysBetween(relationship.createdAt, now);
    push(
      buildInsight({
        id: `ins_new_${id}`,
        type: "new_inquiry",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          status === "walkthrough_requested"
            ? `a walkthrough was requested — schedule and confirm.`
            : `a new inquiry is waiting for a personal reply.`,
        ),
        detail: days === 0 ? "Arrived today." : `${days} day${days === 1 ? "" : "s"} old.`,
        severity: days === 0 ? "attention" : "suggested",
        actions: ["draft", "send_email", "create_task", "dismiss"],
        primaryAction: "draft",
        draftKind: "email",
        priority: 28,
      }),
    );
  }

  // —— Health-based suggestions (recommend only — never auto-act) ——
  const checklistOpen = tasks.filter((t) => isChecklistTask(t) && isOpenTask(t));
  const checklistOverdue = checklistOpen.filter(
    (t) => t.dueDate < now.toISOString().slice(0, 10),
  );
  if (
    (status === "white_glove_implementation" || relationship.onboardingType === "white_glove") &&
    checklistOverdue.length > 0
  ) {
    push(
      buildInsight({
        id: `ins_wg_overdue_${id}`,
        type: "wg_overdue",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `White Glove implementation has ${checklistOverdue.length} overdue checklist item${checklistOverdue.length === 1 ? "" : "s"}.`,
        ),
        detail: checklistOverdue[0]?.title,
        severity: "urgent",
        actions: ["create_task", "draft", "dismiss"],
        primaryAction: "create_task",
        draftKind: "launch_checklist",
        priority: 42,
      }),
    );
  }

  if (
    (relationship.activationCompletedAt || relationship.productSync?.ownerAccountId) &&
    (status === "active" || status === "reactivated" || status === "onboarding") &&
    !relationship.lastLoginAt
  ) {
    const days = relationship.activationCompletedAt
      ? daysBetween(relationship.activationCompletedAt, now)
      : daysBetween(relationship.updatedAt, now);
    if (days >= 3) {
      push(
        buildInsight({
          id: `ins_nologin_${id}`,
          type: "no_login_after_activation",
          relationshipId: id,
          venueName: venue,
          message: address(
            actor,
            `no login after activation (${days} day${days === 1 ? "" : "s"}).`,
          ),
          detail: "I suggest a gentle check-in — recommend only.",
          severity: days >= 7 ? "attention" : "suggested",
          actions: ["draft", "send_email", "create_task", "dismiss"],
          primaryAction: "draft",
          draftKind: "follow_up",
          priority: 34,
        }),
      );
    }
  }

  if (
    (status === "onboarding" || status === "white_glove_implementation") &&
    daysBetween(relationship.updatedAt, now) >= 7
  ) {
    push(
      buildInsight({
        id: `ins_onboard_stall_${id}`,
        type: "onboarding_stalled",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `onboarding looks stalled — little team activity in a week.`,
        ),
        detail: relationship.nextMilestone
          ? `Next milestone: ${relationship.nextMilestone}`
          : undefined,
        severity: "attention",
        actions: ["create_task", "draft", "dismiss"],
        primaryAction: "create_task",
        priority: 33,
      }),
    );
  }

  if (
    relationship.paymentStatus === "failed" ||
    relationship.paymentStatus === "past_due" ||
    relationship.dunning
  ) {
    if (!relationship.dunning?.clearedAt) {
      push(
        buildInsight({
          id: `ins_payfail_${id}`,
          type: "payment_failed",
          relationshipId: id,
          venueName: venue,
          message: address(
            actor,
            `payment failed — dunning may be in progress.`,
          ),
          detail: "Recommend a personal outreach; do not auto-suspend from Luv.",
          severity: status === "suspended" ? "urgent" : "attention",
          actions: ["draft", "send_email", "create_task", "dismiss"],
          primaryAction: "draft",
          draftKind: "follow_up",
          priority: 44,
        }),
      );
    }
  }

  if (
    (status === "active" || status === "reactivated") &&
    daysBetween(
      relationship.lastCustomerActivityAt ||
        relationship.lastLoginAt ||
        relationship.lastContactAt,
      now,
    ) >= 30
  ) {
    push(
      buildInsight({
        id: `ins_inactive_${id}`,
        type: "inactive_customer",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `this customer looks inactive (30+ days without activity).`,
        ),
        detail: "A warm check-in could help — suggestion only.",
        severity: "suggested",
        actions: ["draft", "send_email", "dismiss"],
        primaryAction: "draft",
        draftKind: "follow_up",
        priority: 26,
      }),
    );
  }

  // —— Overdue tasks (non-checklist summary) ——
  const overdue = tasks.filter(
    (t) =>
      isOpenTask(t) &&
      !isChecklistTask(t) &&
      t.dueDate < now.toISOString().slice(0, 10),
  );
  if (overdue.length > 0) {
    push(
      buildInsight({
        id: `ins_tasks_${id}`,
        type: "task_overdue",
        relationshipId: id,
        venueName: venue,
        message: address(
          actor,
          `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} sit on this relationship.`,
        ),
        detail: overdue[0]?.title,
        severity: "attention",
        actions: ["create_task", "dismiss"],
        primaryAction: "create_task",
      }),
    );
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

/** Insights across the whole workspace (for briefing + draft batches). */
export function computeWorkspaceInsights(
  data: WorkspaceData,
  opts?: InsightComputeOpts,
): LuvInsight[] {
  const all: LuvInsight[] = [];
  const allRelationships = opts?.allRelationships ?? data.relationships;
  for (const relationship of data.relationships) {
    all.push(
      ...computeRelationshipInsights(relationship, data, {
        ...opts,
        allRelationships,
      }),
    );
  }
  return all.sort((a, b) => b.priority - a.priority);
}

export function draftKindForInsight(insight: LuvInsight): LuvDraftKind {
  return insight.draftKind ?? "follow_up";
}

/** Helpers exported for briefing copy. */
export function countWords(n: number): string {
  const words = [
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
  ];
  return words[n] ?? String(n);
}

export function daysSinceContact(relationship: Relationship, now = new Date()): number {
  return daysBetween(relationship.lastContactAt, now);
}

export function actorFirstNameFrom(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}
