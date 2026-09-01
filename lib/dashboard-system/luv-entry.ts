/**
 * What Luv says on the Dashboard.
 *
 * Luv's Dashboard role is interpretation, not reporting. Today's Focus already
 * lists the work; if Luv restates a row from it — "Sara Parker has a tour today
 * at 11:00 AM" directly beneath a Today's Focus row saying the same thing — the
 * Dashboard has spent two sections on one fact and Luv has contributed nothing.
 *
 * So this picks, in order of how much interpretation it adds:
 *   1. a recommendation (already advice plus an action),
 *   2. an observation about something NOT already in Today's Focus,
 *   3. failing both, an aggregate read of Today's Focus itself — the insight
 *      layer over those rows rather than a repeat of any one of them.
 */
import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";
import type { LuvObservation } from "@/lib/luv/types";

export type LuvDashboardEntry = {
  /** Luv's interpretation. Never a restatement of a single Today's Focus row. */
  message: string;
  /** The next step being offered, when there is one to offer. */
  suggestion: string | null;
  actionLabel: string;
  actionHref: string;
};

type Aggregate = { summary: (count: number) => string; suggestion: string; actionLabel: string; href: string };

/**
 * Aggregate voice per publishing domain. Phrased as something the app can
 * actually do — Luv offers to take the owner to the work, and does not promise
 * to perform an action (drafting, sending) that no Dashboard control performs.
 */
const DOMAIN_AGGREGATE: Record<string, Aggregate> = {
  Leads: {
    summary: (n) => `${countWord(n, "lead")} ${n === 1 ? "has" : "have"} been waiting for follow-up.`,
    suggestion: "Want to work through them?",
    actionLabel: "Review leads",
    href: "/leads",
  },
  Tasks: {
    summary: (n) => `${countWord(n, "task")} ${n === 1 ? "is" : "are"} past due.`,
    suggestion: "Want to clear them?",
    actionLabel: "Open tasks",
    href: "/tasks",
  },
  "Event Readiness": {
    summary: (n) => `${countWord(n, "booking")} ${n === 1 ? "has" : "have"} something still outstanding.`,
    suggestion: "Want to see what's missing?",
    actionLabel: "Review events",
    href: "/events",
  },
  Calendar: {
    summary: (n) => `${countWord(n, "tour")} ${n === 1 ? "is" : "are"} on today's schedule.`,
    suggestion: "Want to get ready?",
    actionLabel: "Open tours",
    href: "/tours",
  },
  Payments: {
    summary: (n) => `${countWord(n, "payment")} ${n === 1 ? "needs" : "need"} attention.`,
    suggestion: "Want to review them?",
    actionLabel: "Open payments",
    href: "/payments",
  },
};

const SMALL_NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Luv speaks warmly, so small counts are spelled out the way a person would say them. */
function countWord(n: number, noun: string): string {
  const word = n < SMALL_NUMBERS.length ? SMALL_NUMBERS[n] : String(n);
  return `${word} ${noun}${n === 1 ? "" : "s"}`;
}

/** Strips the fragment/query so /leads/123?x=1 and /leads/123 count as the same subject. */
function subject(href: string): string {
  return href.split(/[?#]/)[0];
}

function firstCta(recommendation: VenueRecommendation): { label: string; href: string } | null {
  const cta = recommendation.ctas.find((c) => c.type === "navigate" && c.target);
  return cta ? { label: cta.label, href: cta.target } : null;
}

/**
 * The insight layer over Today's Focus: reads the largest group of work in it
 * and says what it means, rather than repeating its rows.
 */
export function aggregateFocusEntry(focusItems: ClassifiedItem[]): LuvDashboardEntry | null {
  if (focusItems.length === 0) return null;

  const counts = new Map<string, number>();
  for (const item of focusItems) {
    if (!DOMAIN_AGGREGATE[item.domain]) continue;
    counts.set(item.domain, (counts.get(item.domain) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  // Largest group wins; ties break on Today's Focus order so the aggregate
  // matches what the owner sees at the top of the list.
  const order = focusItems.map((i) => i.domain);
  const [domain, count] = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  })[0];

  const shape = DOMAIN_AGGREGATE[domain];
  return {
    message: `I noticed ${shape.summary(count)}`,
    suggestion: shape.suggestion,
    actionLabel: shape.actionLabel,
    actionHref: shape.href,
  };
}

export function selectLuvDashboardEntry({
  focusItems,
  observations,
  recommendations,
}: {
  focusItems: ClassifiedItem[];
  observations: LuvObservation[];
  recommendations: VenueRecommendation[];
}): LuvDashboardEntry | null {
  const focusSubjects = new Set(focusItems.map((i) => subject(i.href)));

  // 1. A recommendation is already interpretation plus an action, so it leads —
  //    unless it points at a row Today's Focus is displaying anyway.
  for (const rec of recommendations) {
    const cta = firstCta(rec);
    if (cta && focusSubjects.has(subject(cta.href))) continue;
    if (!cta) continue;
    return { message: rec.title, suggestion: rec.body || null, actionLabel: cta.label, actionHref: cta.href };
  }

  // 2. An observation, but only about something Today's Focus is not covering.
  for (const obs of observations) {
    if (focusSubjects.has(subject(obs.link))) continue;
    return {
      message: obs.message,
      suggestion: obs.recommendation?.label ?? obs.detail ?? null,
      actionLabel: obs.actionLabel ?? "View",
      actionHref: obs.recommendation?.link ?? obs.link,
    };
  }

  // 3. Everything Luv had to say is already on screen — so interpret it instead.
  return aggregateFocusEntry(focusItems);
}
