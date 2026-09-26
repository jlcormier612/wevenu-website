/**
 * Couple Home — Luv Suggestions (venue-relationship context).
 *
 * Luv is the venue's assistant inside an existing client portal session.
 * She may only speak from facts HTC actually knows about THIS customer and
 * THIS venue — never generic wedding-planning assumptions ("most couples",
 * "you're choosing your venue", inventing guest-list progress, etc.).
 *
 * Venue-required work stays with Your Next Steps. Luv never silently acts.
 */

import type { PortalSection } from "@/lib/portal/types";

export type LuvSuggestionKind =
  | "venue_relationship"
  | "contract"
  | "payment"
  | "venue_attention"
  | "activity"
  | "questionnaire"
  | "guest_planning"
  | "event_countdown"
  | "quiet";

export type LuvHomeSuggestion = {
  kind: LuvSuggestionKind;
  /** Warm conversational body — grounded in known HTC facts only. */
  message: string;
  /** Optional single CTA into an existing portal destination. */
  ctaLabel: string | null;
  destination: PortalSection | null;
  /** Full accessible name for the card / CTA. */
  accessibleLabel: string;
};

export type LuvKnownPayment = {
  label: string;
  /** Human-readable due date already formatted by the caller (e.g. "June 12"). */
  dueDateLabel: string;
};

/**
 * Facts HTC actually knows at portal Home time.
 * Optional fields stay unset when not loaded — Luv must not invent them.
 */
export type LuvHomeSuggestionInput = {
  /** Always known — the couple is inside this venue's portal. */
  venueName: string;
  /** True when an event/booking row is attached to this portal session. */
  hasEvent: boolean;
  daysUntil: number | null;
  /** Formatted event date when known (e.g. "June 21, 2027"). */
  eventDateLabel: string | null;
  guestTotal: number;
  guestAttending: number;
  readiness: number;
  totalThisWeek: number;
  /** Incomplete questionnaire when present; false when submitted/absent. */
  questionnaireOpen: boolean;
  /**
   * Incomplete unified attention count from Your Next Steps.
   * When > 0, Luv can point at venue-shared work without inventing tasks.
   */
  venueAttentionCount: number;
  /** Contract awaiting client signature (document status sent + signable). */
  contractAwaitingSignature: boolean;
  /** At least one contract fully executed / signed. */
  contractFullyExecuted: boolean;
  /** Next outstanding payment with a known due date, if any. */
  nextPayment: LuvKnownPayment | null;
  /**
   * Portal destinations that must not receive a Luv CTA (e.g. Preferred Vendors
   * when the venue has disabled that planning capability).
   */
  disabledDestinations?: readonly PortalSection[];
};

/** Soft language patterns Luv Home must not use. */
const FORBIDDEN =
  /\b(you must|you need to|you're behind|you are behind|action required|complete this task)\b/i;

/** Generic wedding-planning assumptions Luv must never present as true about this customer. */
export const UNSUPPORTED_ASSUMPTION =
  /\b(most couples|choosing (their|your) venue|you'?re just getting started|you'?re almost done planning|you probably|right where many people begin|exploring (their|your) venue)\b/i;

export function usesForbiddenLuvLanguage(text: string): boolean {
  return FORBIDDEN.test(text);
}

export function usesUnsupportedAssumption(text: string): boolean {
  return UNSUPPORTED_ASSUMPTION.test(text);
}

export function isVenueOwnedSuggestionKind(kind: LuvSuggestionKind): boolean {
  return kind === "questionnaire" || kind === "venue_attention";
}

export function shouldSkipForVenueAttention(
  kind: LuvSuggestionKind,
  venueAttentionCount: number,
): boolean {
  if (venueAttentionCount <= 0) return false;
  return isVenueOwnedSuggestionKind(kind);
}

function finish(
  kind: LuvSuggestionKind,
  message: string,
  ctaLabel: string | null,
  destination: PortalSection | null,
): LuvHomeSuggestion {
  const accessibleLabel = ctaLabel
    ? `Luv suggestion: ${message} ${ctaLabel}`
    : `Luv suggestion: ${message}`;
  return { kind, message, ctaLabel, destination, accessibleLabel };
}

function destinationAllowed(
  dest: PortalSection | null,
  disabled: readonly PortalSection[],
): boolean {
  return dest == null || !disabled.includes(dest);
}

/**
 * Neutral welcome grounded only in the venue relationship.
 * Used when no stronger known action applies.
 */
export function getNeutralVenueWelcome(venueName: string, hasEvent: boolean): string {
  const venue = venueName.trim() || "your venue";
  if (hasEvent) {
    return `You're home with ${venue}. I'm here with warm notes about your celebration whenever you'd like one.`;
  }
  return `Welcome to your space with ${venue}. I'm here whenever a gentle next step would help.`;
}

/**
 * Quiet / countdown presence — only uses known daysUntil + venue relationship.
 * Never invents planning milestones or "most couples" framing.
 */
export function getQuietLuvMessage(
  daysUntil: number | null,
  venueName: string,
  hasEvent: boolean,
  eventDateLabel: string | null,
): string {
  const venue = venueName.trim() || "your venue";

  if (daysUntil === null || !hasEvent) {
    return getNeutralVenueWelcome(venue, hasEvent);
  }
  if (daysUntil < 0) {
    return `Your day with ${venue} has arrived and passed — this space keeps the details whenever you want to revisit them.`;
  }
  if (daysUntil === 0) {
    return `Today is your celebration with ${venue}. Everything you've planned together leads to this moment.`;
  }
  if (eventDateLabel && daysUntil <= 14) {
    return `${eventDateLabel} with ${venue} is almost here — ${daysUntil} day${daysUntil === 1 ? "" : "s"} to go.`;
  }
  if (eventDateLabel) {
    return `Your celebration with ${venue} is set for ${eventDateLabel}. I'm here with anything this space already knows about.`;
  }
  return `Your celebration with ${venue} is ${daysUntil} day${daysUntil === 1 ? "" : "s"} away. I'm right here with you.`;
}

/**
 * Resolve exactly one Home Luv suggestion from HTC-known facts only.
 * Priority: actionable known work → known activity → neutral venue welcome.
 */
export function resolveLuvHomeSuggestion(input: LuvHomeSuggestionInput): LuvHomeSuggestion {
  const {
    venueName,
    hasEvent,
    daysUntil,
    eventDateLabel,
    guestTotal,
    totalThisWeek,
    questionnaireOpen,
    venueAttentionCount,
    contractAwaitingSignature,
    contractFullyExecuted,
    nextPayment,
    disabledDestinations = [],
  } = input;

  const allow = (dest: PortalSection | null) => destinationAllowed(dest, disabledDestinations);

  // 1. Contract awaiting signature — HTC knows this from portal documents.
  if (contractAwaitingSignature && allow("documents")) {
    return finish(
      "contract",
      `Your agreement with ${venueName.trim() || "your venue"} is ready to review and sign whenever you have a moment.`,
      "Review agreement",
      "documents",
    );
  }

  // 2. Outstanding payment with a known due date.
  if (nextPayment && allow("payments")) {
    return finish(
      "payment",
      `${nextPayment.label} for ${venueName.trim() || "your venue"} is due ${nextPayment.dueDateLabel}.`,
      "View payments",
      "payments",
    );
  }

  // 3. Venue-shared open items (Your Next Steps already counts these).
  if (venueAttentionCount > 0 && allow("tasks")) {
    const n = venueAttentionCount;
    return finish(
      "venue_attention",
      `${venueName.trim() || "Your venue"} has ${n} open item${n === 1 ? "" : "s"} waiting in Your Next Steps.`,
      "See next steps",
      "tasks",
    );
  }

  // 4. Known weekly activity in this portal.
  if (totalThisWeek > 0) {
    const n = totalThisWeek;
    return finish(
      "activity",
      `You completed ${n} planning ${n === 1 ? "item" : "items"} here this week — lovely momentum with ${venueName.trim() || "your venue"}.`,
      null,
      null,
    );
  }

  // 5. Questionnaire open — only when Next Steps isn't already carrying attention.
  if (
    questionnaireOpen
    && !shouldSkipForVenueAttention("questionnaire", venueAttentionCount)
    && allow("questionnaire")
  ) {
    return finish(
      "questionnaire",
      `${venueName.trim() || "Your venue"} shared a questionnaire whenever you'd like to take a look.`,
      "Take a look",
      "questionnaire",
    );
  }

  // 6. Contract fully executed — acknowledge known state, then soft next.
  if (contractFullyExecuted) {
    return finish(
      "contract",
      `Your agreement with ${venueName.trim() || "your venue"} is fully signed. This space stays ready for anything next that ${venueName.trim() || "your venue"} shares.`,
      null,
      null,
    );
  }

  // 7. Guest list empty — optional couple-owned tool, never "choosing a venue".
  if (hasEvent && guestTotal === 0 && allow("guests") && (daysUntil === null || daysUntil > 30)) {
    return finish(
      "guest_planning",
      `Whenever you're ready, your guest list lives here with ${venueName.trim() || "your venue"} — no rush.`,
      "Open guests",
      "guests",
    );
  }

  // 8. Event countdown with known date.
  if (hasEvent && daysUntil !== null && daysUntil >= 0 && daysUntil <= 90) {
    return finish(
      "event_countdown",
      getQuietLuvMessage(daysUntil, venueName, hasEvent, eventDateLabel),
      null,
      null,
    );
  }

  // 9. Neutral venue-relationship welcome — never invent planning progress.
  return finish(
    "quiet",
    getQuietLuvMessage(daysUntil, venueName, hasEvent, eventDateLabel),
    null,
    null,
  );
}

/** @deprecated Removed — generic "most couples" banks must not be used. */
export const SOCIAL_PROOF_BY_BRACKET: Record<string, string> = {};

/**
 * @deprecated Milestone bank retired — destination hints must not invent
 * wedding-industry stage advice. Kept empty for import compatibility tests
 * that assert vendors gating; prefer resolveLuvHomeSuggestion.
 */
export const NEXT_MILESTONE_BY_BRACKET: Record<
  string,
  { title: string; desc: string; destination: PortalSection; ctaLabel: string }
> = {
  "9-12": {
    title: "",
    desc: "",
    destination: "vendors",
    ctaLabel: "",
  },
};
