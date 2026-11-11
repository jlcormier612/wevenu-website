/**
 * Completed-tour intelligence — tour completion is context, not a reason to write.
 *
 * A completed tour must not automatically recommend a thank-you / "follow up
 * while it's fresh." Luv inspects authoritative relationship evidence and may
 * choose action, a contextual/positive note, or silence.
 *
 * Internal notes never enter customer-facing drafts or ACTION/SILENCE
 * classification. Venue-facing Thoughts may use tour_appointments.notes
 * via venue-facing-tour-thoughts.ts — a separate surface.
 * Pipeline stage is never evidence.
 */
import { customerFacingInquiryContext } from "@/lib/luv/customer-facing-inquiry-context";
import { isCustomerFacingContactMessage, withCoordinatorAddress } from "@/lib/luv/observation-quality";
import type { LuvObservation } from "@/lib/luv/types";

export type ThreadMessage = {
  sentAt: string;
  senderType: string;
  channel: string | null;
  body: string | null;
};

export type CompletedTourPurpose =
  | "unresolved_question"
  | "explicit_request"
  | "none";

export type CompletedTourEvalInput = {
  tourId: string;
  leadId: string;
  contactName: string | null;
  /** Authoritative occurrence clock (completed_at / actual_occurred_at / scheduled_at). */
  occurredAt: string;
  followUpSentAt?: string | null;
  proposalSent: boolean;
  booked?: boolean;
  lost?: boolean;
  contractSigned?: boolean;
  paymentReceived?: boolean;
  messages: ThreadMessage[];
  inquiryMessage?: string | null;
  inquiryOrigin?: string | null;
  coordinatorFirstName?: string | null;
};

export type CompletedTourDecision =
  | { mode: "silence"; purpose: "none" }
  | {
      mode: "actionable";
      purpose: Exclude<CompletedTourPurpose, "none">;
      excerpt: string;
      observation: LuvObservation;
    }
  | {
      mode: "contextual" | "positive";
      purpose: "none";
      observation: LuvObservation;
    };

/** Courtesy closers — not questions and not a reason to invent a reply obligation. */
const THANKS_ONLY =
  /^(thanks|thank you|thx|ty|appreciate it|appreciated)([!.\s]*)?$/i;
const THANKS_COURTESY =
  /^(thanks|thank you|thx|ty)\b[\s\S]{0,80}\b(for having us|for today|for the (tour|visit|time)|so much|again)\b[!.,\s]*$/i;
const FAMILY_PAUSE =
  /\b(parents?|mom|dad|family|fiancé|fiance|partner)\b/i;
const PRICING_REQUEST =
  /\b(pric(?:e|ing)|package|quote|proposal|rates?|cost)\b/i;
const QUESTION_START =
  /^(what|when|where|who|why|how|can|could|would|will|do you|does|is there|are there)\b/i;

function isInbound(msg: ThreadMessage): boolean {
  return msg.senderType === "lead_or_client" || msg.senderType === "contact";
}

function isVenueStaffOutbound(msg: ThreadMessage): boolean {
  return msg.senderType === "venue_staff";
}

function customerFacing(msg: ThreadMessage): boolean {
  return isCustomerFacingContactMessage({
    channel: msg.channel,
    senderType: msg.senderType,
  });
}

export function looksLikeCustomerQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("?")) return true;
  return QUESTION_START.test(t);
}

export function looksLikeExplicitRequest(text: string): boolean {
  return PRICING_REQUEST.test(text);
}

export function looksLikeThanksOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (THANKS_ONLY.test(t) || THANKS_COURTESY.test(t)) return true;
  // Multi-sentence courtesy with no question mark and no question-start clause.
  if (!t.includes("?") && !QUESTION_START.test(t)) {
    const first = t.split(/[.!]/)[0]?.trim() ?? "";
    if (THANKS_ONLY.test(first) || THANKS_COURTESY.test(first) || /^(thanks|thank you)\b/i.test(first)) {
      const rest = t.slice(first.length).replace(/^[\s.!,]+/, "");
      if (!rest || /^(we had a (great|lovely)|it was (great|lovely)|talk soon|see you)\b/i.test(rest)) {
        return true;
      }
    }
  }
  return false;
}

export function looksLikeWaitingOnOthers(text: string): boolean {
  return FAMILY_PAUSE.test(text) && /\b(talk|speak|ask|check|need to)\b/i.test(text);
}

/**
 * Early-arrival / same-day timing / en-route requests about attending the tour.
 * Once the tour is recorded completed, missing venue reply is not proof the
 * request is still open — the visit itself is the resolution evidence.
 * Do not match open-ended "can we come back" style questions after the tour.
 */
export function looksLikeTourAttendanceRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\bcome (?:back|again)\b/i.test(t)) return false;
  return (
    /\bcome in\b[\s\S]{0,40}\b(tonight|today|now|early|earlier|sooner)\b/i.test(t)
    || /\b(tonight|today|now)\b[\s\S]{0,40}\b(instead|come in|stop by)\b/i.test(t)
    || /\bcome (early|sooner|now)\b/i.test(t)
    || /\bstop by\b[\s\S]{0,40}\b(tonight|today|now|early)\b/i.test(t)
    || /\bon (our|my) way\b/i.test(t)
    || /\brunning late\b/i.test(t)
  );
}

/** Shareable customer text for coordinator copy — Gate 2, never internal notes. */
export function shareableCustomerExcerpt(text: string | null | undefined): string | null {
  const ctx = customerFacingInquiryContext(text, "customer");
  if (ctx.status !== "usable") return null;
  const first = ctx.details[0]?.trim();
  if (!first) return null;
  return first.length > 90 ? `${first.slice(0, 87)}…` : first;
}

function topicFromExcerpt(excerpt: string): string {
  const lower = excerpt.toLowerCase();
  if (/\bsaturday\b/.test(lower) && /\bsetup\b/.test(lower)) return "Saturday setup";
  if (PRICING_REQUEST.test(lower)) return "pricing or package details";
  if (FAMILY_PAUSE.test(lower)) return "talking with their family";
  // Prefer the clause that looks like the actual question — never a courtesy opener.
  const clauses = excerpt
    .split(/(?<=[.!?])\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const questionish =
    clauses.find((c) => c.includes("?") || QUESTION_START.test(c))
    ?? clauses.find((c) => !looksLikeThanksOnly(c) && !/^(thanks|thank you)\b/i.test(c))
    ?? excerpt;
  const clause = questionish.replace(/[?!.]+$/, "").trim() || excerpt;
  return clause.length > 60 ? `${clause.slice(0, 57)}…` : clause;
}

/** Compact noun-phrase topics are safe in “asked about {topic}.” Raw question clauses are not. */
export function isCompactInsightTopic(topic: string): boolean {
  const t = topic.trim();
  if (!t) return false;
  if (
    t === "Saturday setup"
    || t === "pricing or package details"
    || t === "talking with their family"
  ) {
    return true;
  }
  if (t.includes("?") || t.length > 40) return false;
  if (/^(can|could|would|will|what|when|where|who|why|how|do |does |is |are |i |we )\b/i.test(t)) {
    return false;
  }
  return true;
}

/**
 * Natural unresolved-question copy for completed-tour Noticed.
 * Lead with the useful observation; offer a draft. Do not narrate DB state
 * ("on the thread") or repeat "go inspect the conversation" in headline + detail.
 */
export function unresolvedQuestionInsightCopy(topic: string): {
  message: string;
  detail: string;
  ctaLabel: string;
} {
  const message = isCompactInsightTopic(topic)
    ? `After the tour, they asked about ${topic}.`
    : "After the tour, they asked something that may still be open.";
  return {
    message,
    detail: "I can draft a reply if you'd like to follow up.",
    ctaLabel: "Draft a reply",
  };
}

function inboundAfter(messages: ThreadMessage[], occurredAt: string): ThreadMessage[] {
  return messages
    .filter(customerFacing)
    .filter(isInbound)
    .filter((m) => m.sentAt >= occurredAt)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

function lastVenueOutboundAfter(messages: ThreadMessage[], afterIso: string): ThreadMessage | null {
  const rows = messages
    .filter(customerFacing)
    .filter(isVenueStaffOutbound)
    .filter((m) => m.sentAt >= afterIso)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  return rows[rows.length - 1] ?? null;
}

function unansweredInbound(
  inbound: ThreadMessage[],
  lastOutbound: ThreadMessage | null,
): ThreadMessage | null {
  const lastIn = inbound[inbound.length - 1];
  if (!lastIn) return null;
  if (lastOutbound && lastOutbound.sentAt > lastIn.sentAt) return null;
  return lastIn;
}

function actionableObservation(input: {
  tourId: string;
  leadId: string;
  message: string;
  detail: string;
  ctaLabel: string;
  coordinatorFirstName?: string | null;
}): LuvObservation {
  return {
    id: `tour-no-followup-${input.tourId}`,
    kind: "risk",
    priority: "high",
    message: withCoordinatorAddress(input.coordinatorFirstName ?? null, input.message),
    detail: input.detail,
    link: `/leads/${input.leadId}`,
    actionLabel: "Open Lead →",
    recommendation: {
      label: input.ctaLabel,
      link: `/leads/${input.leadId}?luv=follow_up_email`,
      type: "draft",
    },
  };
}

/**
 * Pure: decide whether a completed tour is worth speaking about.
 * Tour completion alone → silence.
 */
export function evaluateCompletedTour(input: CompletedTourEvalInput): CompletedTourDecision {
  if (input.booked || input.lost || input.contractSigned || input.paymentReceived) {
    return { mode: "silence", purpose: "none" };
  }
  if (input.followUpSentAt) return { mode: "silence", purpose: "none" };

  const inbound = inboundAfter(input.messages, input.occurredAt);
  const lastOutbound = lastVenueOutboundAfter(input.messages, input.occurredAt);
  const open = unansweredInbound(inbound, lastOutbound);
  const openText = open?.body?.trim() || "";
  const excerpt = shareableCustomerExcerpt(openText);

  // Courtesy-only messages are not unanswered questions — silence.
  if (open && looksLikeThanksOnly(openText)) {
    return { mode: "silence", purpose: "none" };
  }

  if (open && excerpt && looksLikeCustomerQuestion(openText)) {
    // Completed-tour evaluation only runs after status=completed. An
    // early-arrival / same-day attendance ask is resolved by that visit —
    // do not assert "still unanswered" merely because no venue_staff reply
    // was typed into the thread (records may lag real-world action).
    if (looksLikeTourAttendanceRequest(openText)) {
      return { mode: "silence", purpose: "none" };
    }
    // Topic from the full inbound text so a courtesy opener cannot steal the
    // subject when a real question follows in a later sentence.
    const topic = topicFromExcerpt(openText);
    const copy = unresolvedQuestionInsightCopy(topic);
    return {
      mode: "actionable",
      purpose: "unresolved_question",
      excerpt,
      observation: actionableObservation({
        tourId: input.tourId,
        leadId: input.leadId,
        coordinatorFirstName: input.coordinatorFirstName,
        message: copy.message,
        detail: copy.detail,
        ctaLabel: copy.ctaLabel,
      }),
    };
  }

  if (open && excerpt && looksLikeExplicitRequest(openText) && !input.proposalSent) {
    return {
      mode: "actionable",
      purpose: "explicit_request",
      excerpt,
      observation: actionableObservation({
        tourId: input.tourId,
        leadId: input.leadId,
        coordinatorFirstName: input.coordinatorFirstName,
        message: "They asked for pricing or package details, and no proposal has been sent yet.",
        detail: "The request is on the record. A proposal-sent stage is not proof.",
        ctaLabel: "Draft a reply about their request",
      }),
    };
  }

  if (open && excerpt && looksLikeWaitingOnOthers(openText)) {
    // Use the full inbound text for topic — shareable excerpts may be the
    // thanks clause and would otherwise produce garbled "need to Thanks…" copy.
    const topic = topicFromExcerpt(openText);
    return {
      mode: "contextual",
      purpose: "none",
      observation: {
        id: `tour-no-followup-${input.tourId}`,
        kind: "fact",
        priority: "low",
        message: withCoordinatorAddress(
          input.coordinatorFirstName ?? null,
          `After the tour they said they still need to ${topic === "talking with their family" ? "talk with their family" : topic}.`,
        ),
        link: `/leads/${input.leadId}`,
      },
    };
  }

  if (open && excerpt && !looksLikeThanksOnly(openText)) {
    return {
      mode: "contextual",
      purpose: "none",
      observation: {
        id: `tour-no-followup-${input.tourId}`,
        kind: "fact",
        priority: "low",
        message: withCoordinatorAddress(
          input.coordinatorFirstName ?? null,
          `They wrote after the tour — nothing unresolved is sitting on you.`,
        ),
        detail: "No unanswered question or outstanding request is on the customer thread.",
        link: `/leads/${input.leadId}`,
      },
    };
  }

  // Venue already wrote after the tour, or proposal already went out, or nothing open.
  if (lastOutbound || input.proposalSent) {
    return { mode: "silence", purpose: "none" };
  }

  const inquiryCtx = customerFacingInquiryContext(input.inquiryMessage, input.inquiryOrigin);
  const inquiry = inquiryCtx.status === "usable" ? inquiryCtx.details[0] ?? null : null;
  const inquiryText = input.inquiryMessage ?? "";
  const anyVenueOutbound = input.messages.some(
    (m) => customerFacing(m) && isVenueStaffOutbound(m),
  );
  if (
    inquiry
    && !anyVenueOutbound
    && !input.proposalSent
    && looksLikeExplicitRequest(inquiryText)
  ) {
    return {
      mode: "actionable",
      purpose: "explicit_request",
      excerpt: inquiry,
      observation: actionableObservation({
        tourId: input.tourId,
        leadId: input.leadId,
        coordinatorFirstName: input.coordinatorFirstName,
        message: "They asked for pricing or package details, and no proposal has been sent yet.",
        detail: "The request came from their inquiry. Completing the tour did not answer it.",
        ctaLabel: "Draft a reply about their request",
      }),
    };
  }

  return { mode: "silence", purpose: "none" };
}

export function completedTourDraftAllowed(
  decision: CompletedTourDecision,
): decision is Extract<CompletedTourDecision, { mode: "actionable" }> {
  return decision.mode === "actionable";
}
