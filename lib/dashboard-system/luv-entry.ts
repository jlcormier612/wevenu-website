/**
 * What Luv says on the Dashboard.
 *
 * Luv's Dashboard role is interpretation, not reporting. Today's Focus already
 * lists the work; if Luv restates a row from it — or reproduces a Leads list
 * filter the owner can already open — the Dashboard has spent two sections on
 * one fact and Luv has contributed nothing.
 *
 * So this picks, in order of how much interpretation it adds:
 *   1. a recommendation that is not a Leads stale-contact filter duplicate,
 *   2. an observation about something NOT already in Today's Focus,
 *   3. failing both, an aggregate read of Today's Focus — except when that
 *      aggregate would only restate lead follow-ups already listed (and the
 *      Leads page already owns that queue).
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
  /** When set, the Dashboard card can permanently dismiss this recommendation. */
  dismissRecommendationId?: string;
};

type Aggregate = { summary: (count: number) => string; suggestion: string; actionLabel: string; href: string };

/**
 * Aggregate voice per publishing domain. Phrased as something the app can
 * actually do — Luv offers to take the owner to the work, and does not promise
 * to perform an action (drafting, sending) that no Dashboard control performs.
 *
 * Leads are intentionally omitted: aggregating Focus lead rows into a
 * "/leads?attention=stale_contact" CTA duplicates Today's Focus and the Leads
 * filter rather than interpreting anything new.
 */
const DOMAIN_AGGREGATE: Record<string, Aggregate> = {
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
    href: "/payments?filter=attention",
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

/** List-filter destinations (/leads?attention=…) are not the same as a Focus row. */
function pointsAtSameFocusRow(ctaHref: string, focusHref: string): boolean {
  if (subject(ctaHref) !== subject(focusHref)) return false;
  const ctaHasFilter = /[?&](attention|filter)=/.test(ctaHref);
  const focusHasFilter = /[?&](attention|filter)=/.test(focusHref);
  if (ctaHasFilter && !focusHasFilter) return false;
  return true;
}

function firstCta(recommendation: VenueRecommendation): { label: string; href: string } | null {
  const cta = recommendation.ctas.find((c) => c.type === "navigate" && c.target);
  return cta ? { label: cta.label, href: cta.target } : null;
}

/** Recommendations that only restate the Leads stale-contact filter. */
export function isLeadsFilterDuplicateRecommendation(rec: VenueRecommendation): boolean {
  if (rec.type === "lead_followup") return true;
  return rec.ctas.some(
    (c) => c.type === "navigate" && /\/leads\?attention=stale_contact/.test(c.target),
  );
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
  //    unless it points at a Focus row or merely opens the Leads stale filter.
  for (const rec of recommendations) {
    if (isLeadsFilterDuplicateRecommendation(rec)) continue;
    const cta = firstCta(rec);
    if (!cta) continue;
    if (focusItems.some((i) => pointsAtSameFocusRow(cta.href, i.href))) continue;
    return {
      message: rec.title,
      suggestion: rec.body || null,
      actionLabel: cta.label,
      actionHref: cta.href,
      dismissRecommendationId: rec.id,
    };
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

  // 3. Interpret Focus when that interpretation is not a Leads-filter restatement.
  return aggregateFocusEntry(focusItems);
}
