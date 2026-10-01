/**
 * What Luv says on the Dashboard.
 *
 * Luv's Dashboard role is interpretation, not reporting. Today's Focus already
 * lists the work; if Luv restates a row from it — or reproduces a Leads list
 * filter the owner can already open — the Dashboard has spent two sections on
 * one fact and Luv has contributed nothing.
 *
 * Product Lock (attention model): Dashboard may surface only Level-1 —
 * globally pertinent, timely, actionable intelligence. Single-record /
 * lead-specific (Level-3) observations remain computed for lower surfaces;
 * they must not win the one global Dashboard card.
 *
 * So this picks, in order of how much interpretation it adds:
 *   1. a Level-1 recommendation that is not a Leads stale-contact filter duplicate,
 *   2. a Level-1 observation about something NOT already in Today's Focus,
 *   3. failing both, an aggregate read of Today's Focus — except when that
 *      aggregate would only restate lead follow-ups already listed (and the
 *      Leads page already owns that queue).
 */
import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import {
  forensicRecordL1,
  sanitizeObservationFamily,
} from "@/lib/dashboard/forensic-timing";
import type { VenueRecommendation } from "@/lib/luv/recommendation-types";
import { isRecommendationActiveForDisplay } from "@/lib/luv/recommendation-visibility";
import { isPhase5SpotPatternRecommendation } from "@/lib/luv/spot-patterns";
import { TOUR_FOLLOWUP_PATTERN_TYPE } from "@/lib/luv/tour-followup-pattern";
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
  /** When set, the Dashboard card can permanently dismiss this computed observation. */
  dismissObservationId?: string;
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
 * V2 tour follow-up pattern CTA is /tours (Past completed tours). Today's Focus
 * Calendar items also link to /tours for *today's upcoming* schedule — that is
 * not the same actionable work, so do not treat them as Focus duplicates.
 */
export function isTourFollowupPatternRecommendation(rec: VenueRecommendation): boolean {
  return rec.type === TOUR_FOLLOWUP_PATTERN_TYPE;
}

/** Individual V1 tour-no-followup cards — superseded by the venue-level pattern when active. */
export function isTourNoFollowupObservation(obs: LuvObservation): boolean {
  return obs.id.startsWith("tour-no-followup-");
}

/** Single-lead upcoming-tour prep — lead/tour context, never the global Dashboard card. */
export function isTourUpcomingObservation(obs: LuvObservation): boolean {
  return obs.id.startsWith("tour-upcoming-");
}

/**
 * Href that addresses one lead / event / client / contract / invoice / payment /
 * request record. Those destinations are Level-3 workflow/record context.
 */
const RECORD_SCOPED_PATH =
  /^\/(leads|events|clients|contracts|invoices|payments|requests)\/[0-9a-f-]{8,}/i;

export function isRecordScopedHref(href: string): boolean {
  return RECORD_SCOPED_PATH.test(subject(href));
}

/**
 * Level-1 observations are globally pertinent for the one Dashboard card.
 * Level-3 (single-record) observations stay available elsewhere — they are
 * not deleted; they simply cannot occupy the Dashboard slot.
 */
export function isDashboardLevel1Observation(obs: LuvObservation): boolean {
  if (isTourUpcomingObservation(obs)) return false;
  if (isTourNoFollowupObservation(obs)) return false;
  if (obs.id.startsWith("tour-no-show-")) return false;

  // Contextual intelligence S1–S4 — record/workflow L3 only (never Dashboard L1).
  if (obs.id.startsWith("event-contract-unsigned-")) return false;
  if (obs.id.startsWith("event-payment-attention-")) return false;
  if (obs.id.startsWith("inquiry-unattended-")) return false;

  // Known venue-wide families (explicit allowlist).
  if (obs.id.startsWith("setup-gap-")) return true;
  if (obs.id.startsWith("venue-readiness-")) return true;
  if (obs.id.startsWith("insight_")) return true;
  if (obs.id === "comm-all-delivered" || obs.id === "comm-recent-failures") return true;

  const primaryHref = obs.recommendation?.link ?? obs.link;
  if (isRecordScopedHref(primaryHref) || isRecordScopedHref(obs.link)) return false;
  return true;
}

/**
 * Level-1 recommendations: venue-wide patterns and setup/guide gaps.
 * A recommendation whose only navigate CTA is a single record is Level-3.
 */
export function isDashboardLevel1Recommendation(rec: VenueRecommendation): boolean {
  // Phase 5 Spot Patterns are L2 workflow intelligence only — never Dashboard L1.
  if (isPhase5SpotPatternRecommendation(rec)) return false;
  if (isTourFollowupPatternRecommendation(rec)) return true;
  if (rec.type.startsWith("client_ask_gap_")) return true;
  const cta = firstCta(rec);
  if (!cta) return false;
  if (isRecordScopedHref(cta.href)) return false;
  return true;
}

/**
 * While the venue-level pattern is visible OR recently dismissed, individual
 * tour-no-followup observations are the same actionable work. Surfacing them
 * after X makes the V2 dismiss feel like it failed on refresh.
 */
export function shouldSuppressTourNoFollowupObservations(
  recommendations: readonly VenueRecommendation[],
): boolean {
  return recommendations.some((rec) => {
    if (!isTourFollowupPatternRecommendation(rec)) return false;
    // Active pattern, or same row still in the 7-day dismiss cooldown.
    return (
      isRecommendationActiveForDisplay(rec) ||
      Boolean(rec.dismissedAt && !isRecommendationActiveForDisplay(rec))
    );
  });
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
  const suppressTourNoFollowup = shouldSuppressTourNoFollowupObservations(recommendations);

  // 1. A Level-1 recommendation is already interpretation plus an action, so it
  //    leads — unless it points at a Focus row or merely opens the Leads stale filter.
  for (const rec of recommendations) {
    if (!isRecommendationActiveForDisplay(rec)) continue;
    if (isLeadsFilterDuplicateRecommendation(rec)) continue;
    if (!isDashboardLevel1Recommendation(rec)) continue;
    const cta = firstCta(rec);
    if (!cta) continue;
    // Cross-lead tour follow-up pattern must not be suppressed by Calendar Focus
    // rows that also navigate to /tours for today's upcoming schedule.
    if (
      !isTourFollowupPatternRecommendation(rec) &&
      focusItems.some((i) => pointsAtSameFocusRow(cta.href, i.href))
    ) {
      continue;
    }
    forensicRecordL1({
      source: "recommendation",
      type: rec.type,
      candidate: rec.type,
      path: "selectLuvDashboardEntry.recommendation",
    });
    return {
      message: rec.title,
      suggestion: rec.body || null,
      actionLabel: cta.label,
      actionHref: cta.href,
      dismissRecommendationId: rec.id,
    };
  }

  // 2. A Level-1 observation, but only about something Today's Focus is not covering.
  //    Suppress individual tour-no-followup cards while the venue-level pattern
  //    is active or recently dismissed (same work as the V2 recommendation).
  //    Level-3 / single-record observations never win this slot.
  for (const obs of observations) {
    if (!isDashboardLevel1Observation(obs)) continue;
    if (suppressTourNoFollowup && isTourNoFollowupObservation(obs)) continue;
    if (focusSubjects.has(subject(obs.link))) continue;
    const family = sanitizeObservationFamily(obs.id);
    forensicRecordL1({
      source: "observation",
      type: family,
      candidate: family,
      path: "selectLuvDashboardEntry.observation",
    });
    return {
      message: obs.message,
      suggestion: obs.recommendation?.label ?? obs.detail ?? null,
      actionLabel: obs.actionLabel ?? "View",
      actionHref: obs.recommendation?.link ?? obs.link,
      dismissObservationId: obs.id,
    };
  }

  // 3. Interpret Focus when that interpretation is not a Leads-filter restatement.
  const aggregate = aggregateFocusEntry(focusItems);
  if (aggregate) {
    forensicRecordL1({
      source: "focus_aggregate",
      type: aggregate.actionHref,
      candidate: aggregate.actionHref,
      path: "selectLuvDashboardEntry.focus_aggregate",
    });
  } else {
    forensicRecordL1({
      source: "NONE",
      type: null,
      candidate: null,
      path: "selectLuvDashboardEntry.none",
    });
  }
  return aggregate;
}
