import type { WorkspaceData } from "@/lib/types";
import { normalizeRelationshipStatus } from "@/lib/pipeline";

import { getDismissedInsightIdsSync } from "./dismissals";
import {
  actorFirstNameFrom,
  computeWorkspaceInsights,
  countWords,
  daysSinceContact,
} from "./insights";
import type { LuvBriefing, LuvBriefingBullet, LuvInsight } from "./types";

function timeOfDayGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function overnightCutoff(now: Date): Date {
  const d = new Date(now);
  d.setHours(d.getHours() - 18);
  return d;
}

function isOvernight(iso: string, now: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= overnightCutoff(now).getTime() && t <= now.getTime();
}

function addFollowUp(bucket: LuvInsight[], insight: LuvInsight | undefined) {
  if (!insight) return;
  if (!insight.actions.includes("draft") && !insight.actions.includes("send_email")) {
    return;
  }
  if (bucket.some((i) => i.id === insight.id)) return;
  bucket.push(insight);
}

/**
 * Build the acting user's daily briefing from live/seed workspace data.
 * Suggestions-first narrative — not a dashboard dump. Not morning-only.
 */
export function buildDailyBriefing(
  data: WorkspaceData,
  actor: { id: string; name: string },
  opts?: { now?: Date },
): LuvBriefing {
  const now = opts?.now ?? new Date();
  const dismissed = getDismissedInsightIdsSync(actor.id);
  const name = actorFirstNameFrom(actor.name);
  const insights = computeWorkspaceInsights(data, {
    now,
    dismissedIds: dismissed,
    actorFirstName: name,
    allRelationships: data.relationships,
  });

  const bullets: LuvBriefingBullet[] = [];
  const followUpInsights: LuvInsight[] = [];
  const usedInsightIds = new Set<string>();

  const pushBullet = (bullet: LuvBriefingBullet, insight?: LuvInsight) => {
    bullets.push(bullet);
    if (insight) {
      usedInsightIds.add(insight.id);
      addFollowUp(followUpInsights, insight);
    }
  };

  // Critical: prospect replied — surface immediately for F/U.
  const respondedInsights = insights
    .filter((i) => i.type === "sales_responded" && !usedInsightIds.has(i.id))
    .sort((a, b) => b.priority - a.priority);
  if (respondedInsights.length > 0) {
    const n = respondedInsights.length;
    const names = respondedInsights
      .slice(0, 2)
      .map((i) => i.venueName)
      .join(" and ");
    const top = respondedInsights[0];
    const days = Number(top.meta?.daysSinceInbound ?? 0);
    const when =
      days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
    pushBullet(
      {
        id: "b_sales_responded",
        text:
          n === 1
            ? `${names} responded ${when} — follow up immediately.`
            : `${countWords(n)} prospects responded and need a reply, including ${names}.`,
        relationshipId: top.relationshipId,
        insightId: top.id,
      },
      top,
    );
    for (const insight of respondedInsights.slice(1, 4)) {
      addFollowUp(followUpInsights, insight);
      usedInsightIds.add(insight.id);
    }
  }

  // Overnight walkthrough / inquiry arrivals.
  const overnightWalkthroughs = data.relationships.filter((r) => {
    const status = normalizeRelationshipStatus(r.status);
    const fresh =
      isOvernight(r.createdAt, now) ||
      data.timelineEvents.some(
        (e) =>
          e.relationshipId === r.id &&
          (e.type === "walkthrough_requested" || e.type === "inquiry_received") &&
          isOvernight(e.occurredAt, now),
      );
    return (
      fresh &&
      (status === "inquiry" ||
        status === "walkthrough_requested" ||
        status === "walkthrough_scheduled")
    );
  });
  if (overnightWalkthroughs.length > 0) {
    const n = overnightWalkthroughs.length;
    const names = overnightWalkthroughs
      .slice(0, 2)
      .map((r) => r.venue.name)
      .join(" and ");
    pushBullet({
      id: "b_overnight_wt",
      text:
        n === 1
          ? `${names} arrived overnight — a walkthrough request waiting for you.`
          : `${countWords(n)} new walkthrough requests arrived overnight, including ${names}.`,
      relationshipId: overnightWalkthroughs[0]?.id,
    });
    for (const r of overnightWalkthroughs) {
      addFollowUp(
        followUpInsights,
        insights.find(
          (i) =>
            i.relationshipId === r.id &&
            (i.type === "new_inquiry" || i.type === "walkthrough_followup"),
        ),
      );
    }
  }

  // Overnight subscriptions.
  const overnightSubs = data.timelineEvents.filter(
    (e) => e.type === "subscription_purchased" && isOvernight(e.occurredAt, now),
  );
  if (overnightSubs.length > 0) {
    const n = overnightSubs.length;
    const first = data.relationships.find((r) => r.id === overnightSubs[0]?.relationshipId);
    pushBullet({
      id: "b_overnight_sub",
      text:
        n === 1 && first
          ? `${first.venue.name} subscribed overnight — check that Welcome is on its way.`
          : `${countWords(n)} venues subscribed overnight.`,
      relationshipId: overnightSubs[0]?.relationshipId,
    });
    for (const e of overnightSubs) {
      addFollowUp(
        followUpInsights,
        insights.find(
          (i) =>
            i.relationshipId === e.relationshipId &&
            (i.type === "welcome_missing" || i.type === "launch_checklist"),
        ),
      );
    }
  }

  // Overnight support.
  const overnightSupport = data.timelineEvents.filter(
    (e) => e.type === "support_request" && isOvernight(e.occurredAt, now),
  );
  if (overnightSupport.length > 0 && bullets.length < 7) {
    const n = overnightSupport.length;
    const first = data.relationships.find((r) => r.id === overnightSupport[0]?.relationshipId);
    pushBullet({
      id: "b_overnight_support",
      text:
        n === 1 && first
          ? `${first.venue.name} opened a support thread overnight.`
          : `${countWords(n)} support requests landed overnight.`,
      relationshipId: overnightSupport[0]?.relationshipId,
    });
  }

  // Welcome missing (subscribed, no welcome email).
  const welcomeMissing = insights.find(
    (i) => i.type === "welcome_missing" && !usedInsightIds.has(i.id),
  );
  if (welcomeMissing && bullets.length < 7) {
    pushBullet(
      {
        id: `b_${welcomeMissing.id}`,
        text: `${welcomeMissing.venueName} hasn't received their Welcome email yet.`,
        relationshipId: welcomeMissing.relationshipId,
        insightId: welcomeMissing.id,
      },
      welcomeMissing,
    );
  }

  // Welcome Back pending.
  const welcomeBack = data.relationships.filter(
    (r) => r.welcomeBackRequested && r.welcomeBackVerified === "pending",
  );
  if (welcomeBack.length > 0 && bullets.length < 7) {
    const n = welcomeBack.length;
    const names = welcomeBack
      .slice(0, 2)
      .map((r) => r.venue.name)
      .join(" and ");
    pushBullet({
      id: "b_welcome_back",
      text:
        n === 1
          ? `${names} requested Welcome Back pricing — verify when you can.`
          : `${countWords(n)} venues requested Welcome Back, including ${names}.`,
      relationshipId: welcomeBack[0]?.id,
    });
    for (const r of welcomeBack) {
      addFollowUp(
        followUpInsights,
        insights.find((i) => i.type === "welcome_back" && i.relationshipId === r.id),
      );
    }
  }

  // Kickoff overdue (prefer over incomplete).
  const kickoffOverdue = insights.find(
    (i) => i.type === "kickoff_overdue" && !usedInsightIds.has(i.id),
  );
  if (kickoffOverdue && bullets.length < 7) {
    const days = Number(kickoffOverdue.meta?.overdueDays ?? 0);
    pushBullet(
      {
        id: `b_${kickoffOverdue.id}`,
        text: `${kickoffOverdue.venueName}'s kickoff is overdue by ${days} day${days === 1 ? "" : "s"}.`,
        relationshipId: kickoffOverdue.relationshipId,
        insightId: kickoffOverdue.id,
      },
      kickoffOverdue,
    );
  } else {
    const wgInsight = insights.find(
      (i) => i.type === "white_glove_kickoff" && !usedInsightIds.has(i.id),
    );
    if (wgInsight && bullets.length < 7) {
      pushBullet(
        {
          id: `b_${wgInsight.id}`,
          text: `${wgInsight.venueName} still has White Glove kickoff ahead.`,
          relationshipId: wgInsight.relationshipId,
          insightId: wgInsight.id,
        },
        wgInsight,
      );
    }
  }

  // Launch checklist.
  const launch = insights.find(
    (i) => i.type === "launch_checklist" && !usedInsightIds.has(i.id),
  );
  if (launch && bullets.length < 7) {
    pushBullet(
      {
        id: `b_${launch.id}`,
        text: `I suggest sending ${launch.venueName} the Launch Checklist today.`,
        relationshipId: launch.relationshipId,
        insightId: launch.id,
      },
      launch,
    );
  }

  // Silence (7+ days).
  const silence = [...insights]
    .filter((i) => i.type === "silence")
    .sort(
      (a, b) => Number(b.meta?.silenceDays ?? 0) - Number(a.meta?.silenceDays ?? 0),
    )[0];
  if (silence && !usedInsightIds.has(silence.id) && bullets.length < 7) {
    const rel = data.relationships.find((r) => r.id === silence.relationshipId);
    const days = Number(
      silence.meta?.silenceDays ?? (rel ? daysSinceContact(rel, now) : 0),
    );
    pushBullet(
      {
        id: `b_${silence.id}`,
        text: `${silence.venueName} has gone ${days} day${days === 1 ? "" : "s"} without a response.`,
        relationshipId: silence.relationshipId,
        insightId: silence.id,
      },
      silence,
    );
  }

  // Walkthrough follow-up gaps.
  const wtGap = insights.find(
    (i) => i.type === "walkthrough_followup" && !usedInsightIds.has(i.id),
  );
  if (wtGap && bullets.length < 7) {
    pushBullet(
      {
        id: `b_${wtGap.id}`,
        text: `${wtGap.venueName} is waiting on a post-walkthrough follow-up.`,
        relationshipId: wtGap.relationshipId,
        insightId: wtGap.id,
      },
      wtGap,
    );
  }

  // Recommend White Glove.
  const wgRec = insights.find(
    (i) => i.type === "recommend_white_glove" && !usedInsightIds.has(i.id),
  );
  if (wgRec && bullets.length < 7) {
    pushBullet(
      {
        id: `b_${wgRec.id}`,
        text: `${wgRec.venueName} looks similar to a White Glove success — worth recommending.`,
        relationshipId: wgRec.relationshipId,
        insightId: wgRec.id,
      },
      wgRec,
    );
  }

  // Expansion opportunity.
  const expansion = insights.find((i) => i.type === "expansion" && !usedInsightIds.has(i.id));
  if (expansion && bullets.length < 7) {
    pushBullet(
      {
        id: `b_${expansion.id}`,
        text: `${expansion.venueName} looks ready for an expansion conversation.`,
        relationshipId: expansion.relationshipId,
        insightId: expansion.id,
      },
      expansion,
    );
  }

  // Support needing care.
  const support = insights.find((i) => i.type === "support_open" && !usedInsightIds.has(i.id));
  if (support && bullets.length < 7) {
    pushBullet(
      {
        id: `b_${support.id}`,
        text: `${support.venueName} has an open support thread — stay close.`,
        relationshipId: support.relationshipId,
        insightId: support.id,
      },
      support,
    );
  }

  if (bullets.length === 0) {
    bullets.push({
      id: "b_calm",
      text: "The board looks calm — a good stretch to deepen two relationships.",
    });
    for (const insight of insights
      .filter((i) => i.actions.includes("draft") || i.actions.includes("send_email"))
      .slice(0, 3)) {
      addFollowUp(followUpInsights, insight);
    }
  }

  const uniqueFollowUps = [...new Map(followUpInsights.map((i) => [i.id, i])).values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);

  if (uniqueFollowUps.length < 3) {
    for (const insight of insights) {
      if (uniqueFollowUps.length >= 5) break;
      if (!insight.actions.includes("draft") && !insight.actions.includes("send_email")) {
        continue;
      }
      if (uniqueFollowUps.some((i) => i.id === insight.id)) continue;
      uniqueFollowUps.push(insight);
    }
  }

  return {
    greeting: `${timeOfDayGreeting(now)}, ${name}.`,
    firstName: name,
    bullets,
    closing: "Would you like me to draft today's follow-ups?",
    followUpInsights: uniqueFollowUps,
    generatedAt: now.toISOString(),
  };
}
