/**
 * Couple Home — Luv Suggestions presentation (Impl 6).
 *
 * Suggestions-first, observational, optional. Reuses the Phase 1 LuvDailyCard
 * priority chain and existing data inputs — no new AI backend, recommendation
 * algorithm, or autonomous actions.
 *
 * Venue-required work stays with Your Next Steps. Luv must not silently act.
 */

import { getOverviewObservation } from "@/lib/luv/portal-observations";
import type { PortalSection } from "@/lib/portal/types";

export type LuvSuggestionKind =
  | "key_date"
  | "progress"
  | "activity"
  | "questionnaire"
  | "guest_planning"
  | "milestone"
  | "social_proof"
  | "quiet";

export type LuvHomeSuggestion = {
  kind: LuvSuggestionKind;
  /** Warm conversational body — never productivity/mandate language. */
  message: string;
  /** Optional single CTA into an existing portal destination. */
  ctaLabel: string | null;
  destination: PortalSection | null;
  /** Full accessible name for the card / CTA. */
  accessibleLabel: string;
};

export type LuvHomeSuggestionInput = {
  daysUntil: number | null;
  guestTotal: number;
  guestAttending: number;
  readiness: number;
  bracket: string;
  totalThisWeek: number;
  /** Incomplete questionnaire status when present; null when submitted/absent. */
  questionnaireOpen: boolean;
  /** Next venue key-date within 7 days, if any. */
  soonKeyDate: { label: string; date: string } | null;
  /**
   * Incomplete unified attention count from Your Next Steps.
   * When > 0, Luv skips venue-owned signals (questionnaire, venue readiness).
   */
  venueAttentionCount: number;
  /** Day of month (1–31) — preserves existing even/odd milestone vs social rotation. */
  dayOfMonth: number;
};

/** Soft language patterns Luv Home must not use. */
const FORBIDDEN =
  /\b(you must|you need to|you're behind|you are behind|action required|complete this task)\b/i;

export function usesForbiddenLuvLanguage(text: string): boolean {
  return FORBIDDEN.test(text);
}

/**
 * Venue-owned suggestion kinds Next Steps already communicates when attention > 0.
 * Default: do not duplicate.
 */
export function isVenueOwnedSuggestionKind(kind: LuvSuggestionKind): boolean {
  return kind === "questionnaire" || kind === "progress";
}

export function shouldSkipForVenueAttention(
  kind: LuvSuggestionKind,
  venueAttentionCount: number,
): boolean {
  if (venueAttentionCount <= 0) return false;
  return isVenueOwnedSuggestionKind(kind);
}

// Social-proof / milestone banks absorbed by Luv (same copy sources as Phase 1).
export const SOCIAL_PROOF_BY_BRACKET: Record<string, string> = {
  "12+":
    "Most couples this far out are choosing their venue and starting their guest list — you're right where many people begin.",
  "9-12":
    "Most couples at 9–12 months are exploring photographers, florists, and caterers. This can be a lovely season for big decisions.",
  "6-9":
    "Most couples at 6–9 months are thinking about invitations and booking hair & makeup trials — whenever that feels right for you.",
  "3-6":
    "Most couples at 3–6 months are gently refining guest count and day-of timing. There's room to enjoy the process.",
  "1-3":
    "Most couples in the final stretch are writing vows and confirming details — savor the moments that feel meaningful.",
  "<1":
    "Most couples this close are simply trying to enjoy the moment — you've already done so much.",
};

export const NEXT_MILESTONE_BY_BRACKET: Record<
  string,
  { title: string; desc: string; destination: PortalSection; ctaLabel: string }
> = {
  "12+": {
    title: "You might enjoy starting your guest list",
    desc: "One of the most exciting parts of planning — who will celebrate with you?",
    destination: "guests",
    ctaLabel: "Explore",
  },
  "9-12": {
    title: "A florist conversation could be lovely",
    desc: "Whenever you're curious, browsing preferred vendors is a gentle way to start.",
    destination: "vendors",
    ctaLabel: "Take a look",
  },
  "6-9": {
    title: "Save-the-dates can be a sweet project",
    desc: "If you'd like, jot a note in your plans when it feels right.",
    destination: "todos",
    ctaLabel: "Start planning",
  },
  "3-6": {
    title: "Invitations can wait until you're ready",
    desc: "A small note in your plans keeps the idea close without pressure.",
    destination: "todos",
    ctaLabel: "Continue",
  },
  "1-3": {
    title: "Writing vows can be a quiet joy",
    desc: "Give the words the time they deserve — whenever you're ready.",
    destination: "todos",
    ctaLabel: "Continue",
  },
  "<1": {
    title: "Take a soft breath",
    desc: "You've done the hard part. Enjoy the countdown when you can.",
    destination: "story",
    ctaLabel: "Add a memory",
  },
};

/** Quiet / mood fallback — existing warm presence, not invented tasks. */
export function getQuietLuvMessage(
  daysUntil: number | null,
  guestTotal: number,
  readiness: number,
): string {
  if (daysUntil === null) return "Your wedding planning is underway. You're doing beautifully.";
  if (daysUntil < 0) {
    return "You made it. Every detail of how you got here lives in this space — revisit it whenever you want to remember.";
  }
  if (daysUntil === 0) {
    return "Today is your wedding day. Everything you've planned leads to this moment. You're going to be extraordinary.";
  }
  if (daysUntil > 365) {
    return "You have a beautiful journey ahead. There's plenty of time to enjoy every moment.";
  }
  if (daysUntil > 270) {
    return "This is such an exciting time. Many couples at your stage are exploring their venue and photographer.";
  }
  if (daysUntil > 180 && guestTotal === 0) {
    return "Your guest list is the heart of your celebration. Whenever you're ready, it can be a lovely place to begin.";
  }
  if (daysUntil > 180) {
    return `With ${guestTotal} guests on your list, you're building something beautiful. Invitations typically go out 2–3 months out — no rush.`;
  }
  if (daysUntil > 90 && readiness < 50) {
    return "You already have what it takes to make this incredible. A few focused weeks of planning can bring it all together when you're ready.";
  }
  if (daysUntil > 90) {
    return "You're making wonderful progress. The details are coming together exactly as they should.";
  }
  if (daysUntil > 30) {
    return "The final weeks before a wedding are often the most magical. Your special day is almost here.";
  }
  return "Your wedding day is so close. Breathe, celebrate, and enjoy every moment of this journey.";
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

/**
 * Resolve exactly one Home Luv suggestion from existing inputs.
 * Preserves Phase 1 priority order with warm reframes + venue-duplication skips.
 */
export function resolveLuvHomeSuggestion(input: LuvHomeSuggestionInput): LuvHomeSuggestion {
  const {
    daysUntil,
    guestTotal,
    guestAttending,
    readiness,
    bracket,
    totalThisWeek,
    questionnaireOpen,
    soonKeyDate,
    venueAttentionCount,
    dayOfMonth,
  } = input;

  // 1. Near key-date — observational gentle reminder
  if (soonKeyDate) {
    const weekday = new Date(soonKeyDate.date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
    });
    const label = soonKeyDate.label.trim() || "upcoming date";
    return finish(
      "key_date",
      `Your ${label.toLowerCase()} is coming up on ${weekday} — a nice moment to keep in mind.`,
      null,
      null,
    );
  }

  // 2. Overview observation — soft reframes; skip venue-owned when P1 active
  const observation = getOverviewObservation(
    { total: guestTotal, attending: guestAttending },
    readiness,
    daysUntil,
  );

  if (observation) {
    if (observation.id === "final-stretch") {
      if (!shouldSkipForVenueAttention("progress", venueAttentionCount)) {
        const days = daysUntil ?? 0;
        return finish(
          "progress",
          `With ${days} days to go, you're in a beautiful stretch of planning. Enjoy the details that feel good to you.`,
          null,
          null,
        );
      }
      // Fall through — Next Steps owns venue readiness.
    } else if (observation.id === "no-rsvps") {
      return finish(
        "guest_planning",
        "Your guest list is starting to take shape. This could be a good time to review it.",
        "Review",
        "guests",
      );
    } else if (observation.id === "early-and-empty") {
      return finish(
        "guest_planning",
        "You might enjoy starting your guest list whenever you're ready — there's plenty of time.",
        "Explore",
        "guests",
      );
    }
  }

  // 3. Activity reflection
  if (totalThisWeek > 0) {
    const n = totalThisWeek;
    return finish(
      "activity",
      `You completed ${n} planning ${n === 1 ? "item" : "items"} this week — lovely momentum.`,
      null,
      null,
    );
  }

  // 4. Questionnaire — only when Next Steps is clear (not duplicating venue work)
  if (
    questionnaireOpen &&
    !shouldSkipForVenueAttention("questionnaire", venueAttentionCount)
  ) {
    return finish(
      "questionnaire",
      "Your questionnaire is ready whenever you'd like to take a look.",
      "Take a look",
      "questionnaire",
    );
  }

  // 5. Bracket milestone / social proof when early-to-mid planning
  if (daysUntil === null || daysUntil > 14) {
    if (dayOfMonth % 2 === 0) {
      const milestone =
        guestTotal === 0 && bracket !== "<1"
          ? NEXT_MILESTONE_BY_BRACKET["12+"]
          : (NEXT_MILESTONE_BY_BRACKET[bracket] ?? NEXT_MILESTONE_BY_BRACKET["6-9"]);
      return finish(
        "milestone",
        `${milestone.title}. ${milestone.desc}`,
        milestone.ctaLabel,
        milestone.destination,
      );
    }
    const proof = SOCIAL_PROOF_BY_BRACKET[bracket] ?? SOCIAL_PROOF_BY_BRACKET["6-9"];
    return finish("social_proof", proof, null, null);
  }

  // 6. Quiet warm presence — do not invent venue tasks
  return finish(
    "quiet",
    getQuietLuvMessage(daysUntil, guestTotal, readiness),
    null,
    null,
  );
}
