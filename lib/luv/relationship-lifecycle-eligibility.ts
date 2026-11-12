/**
 * Centralized relationship lifecycle eligibility for Luv communications.
 *
 * Pure / deterministic — does not mutate records.
 *
 * Separates:
 *   A. Official booking state (application Booked clock)
 *   B. Communication relationship state (is prospect sales outreach appropriate?)
 *   C. Intent eligibility (is this specific draft/action appropriate?)
 *
 * A signed contract may supersede sales outreach without implying official Booked.
 */

import type { FollowUpWorkflowIntent } from "@/lib/luv/follow-up-workflow-context";

/** A — Official booking determination (existing application clocks). */
export type OfficialBookingState =
  | "not_booked"
  | "booked"
  | "lost"
  | "archived";

/**
 * B — Whether prospect-oriented sales outreach is still appropriate.
 * Distinct from official Booked: commercial commitment can supersede sales
 * without changing booking stamps.
 */
export type CommunicationRelationshipState =
  | "prospect"
  | "commercially_committed"
  | "booked_client"
  | "lost"
  | "archived"
  | "past_event";

export type RelationshipLifecycleFacts = {
  /** leads.first_booked_at — authoritative Booked clock. */
  firstBookedAt?: string | null;
  /** Linked clients.lifecycle_booked_at when present. */
  clientLifecycleBookedAt?: string | null;
  lostAt?: string | null;
  leadStatus?: string | null;
  salesStage?: string | null;
  /** Linked contract fully executed (status=signed or client signer signed). */
  contractSigned?: boolean;
  /** Any paid payment_line_item on a linked client schedule. */
  paymentReceived?: boolean;
  /** Linked event/client event_date in the past (date-only ISO). */
  eventDatePast?: boolean;
  /** Booking/event cancelled (when known). */
  bookingCancelled?: boolean;
  /** Email/SMS channel still permitted for the intended send. */
  channelConsentOk?: boolean;
};

export type SalesFollowUpBlockReasonCode =
  | "lost"
  | "archived"
  | "officially_booked"
  | "contract_signed"
  | "payment_received"
  | "past_event"
  | "booking_cancelled"
  | "consent_revoked";

export type RelationshipLifecycleDecision = {
  officialBookingState: OfficialBookingState;
  communicationRelationshipState: CommunicationRelationshipState;
  /** Prospect-oriented sales follow-ups (tour invite / upcoming tour / sales check-in). */
  salesFollowUpAllowed: boolean;
  salesFollowUpBlockReasonCode: SalesFollowUpBlockReasonCode | null;
  salesFollowUpBlockReason: string | null;
  /** Owner may still use non-sales / planning surfaces; this module only gates sales follow-ups. */
  commerciallyCommitted: boolean;
  officiallyBooked: boolean;
};

const SALES_FOLLOW_UP_INTENTS: ReadonlySet<FollowUpWorkflowIntent> = new Set([
  "reference_upcoming_tour",
  "invite_to_schedule_tour",
  "acknowledge_completed_tour",
  "gentle_check_in",
  "follow_recorded_next_action",
]);

/** Intents that remain appropriate after commercial commitment when purpose-built. */
const POST_COMMITMENT_ALLOWED_INTENTS: ReadonlySet<FollowUpWorkflowIntent> = new Set([
  "answer_questions",
  "no_outreach",
]);

export function isSalesFollowUpIntent(intent: FollowUpWorkflowIntent): boolean {
  return SALES_FOLLOW_UP_INTENTS.has(intent);
}

export function isOfficiallyBooked(facts: Pick<RelationshipLifecycleFacts, "firstBookedAt" | "clientLifecycleBookedAt">): boolean {
  return Boolean(facts.firstBookedAt) || Boolean(facts.clientLifecycleBookedAt);
}

export function isCommerciallyCommitted(facts: RelationshipLifecycleFacts): boolean {
  if (isOfficiallyBooked(facts)) return true;
  if (facts.contractSigned) return true;
  if (facts.paymentReceived) return true;
  return false;
}

export function resolveOfficialBookingState(
  facts: RelationshipLifecycleFacts,
): OfficialBookingState {
  const status = (facts.leadStatus ?? "").toLowerCase();
  if (status === "archived") return "archived";
  if (facts.lostAt || status === "lost" || (facts.salesStage ?? "").toLowerCase() === "lost") {
    return "lost";
  }
  if (isOfficiallyBooked(facts)) return "booked";
  return "not_booked";
}

export function resolveRelationshipLifecycle(
  facts: RelationshipLifecycleFacts,
): RelationshipLifecycleDecision {
  const officialBookingState = resolveOfficialBookingState(facts);
  const officiallyBooked = officialBookingState === "booked";
  const commerciallyCommitted = isCommerciallyCommitted(facts);

  if (officialBookingState === "archived") {
    return {
      officialBookingState,
      communicationRelationshipState: "archived",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "archived",
      salesFollowUpBlockReason: "This inquiry is archived — a sales follow-up isn’t appropriate.",
      commerciallyCommitted,
      officiallyBooked,
    };
  }

  if (officialBookingState === "lost") {
    return {
      officialBookingState,
      communicationRelationshipState: "lost",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "lost",
      salesFollowUpBlockReason: "This inquiry is marked lost — a sales follow-up isn’t appropriate.",
      commerciallyCommitted,
      officiallyBooked,
    };
  }

  if (facts.bookingCancelled) {
    return {
      officialBookingState,
      communicationRelationshipState: "prospect",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "booking_cancelled",
      salesFollowUpBlockReason:
        "This booking was cancelled — the original sales follow-up is no longer appropriate.",
      commerciallyCommitted: false,
      officiallyBooked,
    };
  }

  if (facts.eventDatePast && commerciallyCommitted) {
    return {
      officialBookingState,
      communicationRelationshipState: "past_event",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "past_event",
      salesFollowUpBlockReason: "This event is in the past — prospecting follow-ups aren’t appropriate.",
      commerciallyCommitted,
      officiallyBooked,
    };
  }

  if (facts.channelConsentOk === false) {
    return {
      officialBookingState,
      communicationRelationshipState: commerciallyCommitted
        ? (officiallyBooked ? "booked_client" : "commercially_committed")
        : "prospect",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "consent_revoked",
      salesFollowUpBlockReason: "Communication consent is no longer in place for this channel.",
      commerciallyCommitted,
      officiallyBooked,
    };
  }

  if (officiallyBooked) {
    return {
      officialBookingState,
      communicationRelationshipState: "booked_client",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "officially_booked",
      salesFollowUpBlockReason:
        "This couple is already booked — a sales or tour follow-up isn’t appropriate.",
      commerciallyCommitted: true,
      officiallyBooked: true,
    };
  }

  if (facts.contractSigned) {
    return {
      officialBookingState,
      communicationRelationshipState: "commercially_committed",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "contract_signed",
      salesFollowUpBlockReason:
        "A contract is already signed — treating them as an unconverted sales prospect isn’t appropriate.",
      commerciallyCommitted: true,
      officiallyBooked: false,
    };
  }

  if (facts.paymentReceived) {
    return {
      officialBookingState,
      communicationRelationshipState: "commercially_committed",
      salesFollowUpAllowed: false,
      salesFollowUpBlockReasonCode: "payment_received",
      salesFollowUpBlockReason:
        "A payment has already been received — a sales or tour follow-up isn’t appropriate.",
      commerciallyCommitted: true,
      officiallyBooked: false,
    };
  }

  return {
    officialBookingState,
    communicationRelationshipState: "prospect",
    salesFollowUpAllowed: true,
    salesFollowUpBlockReasonCode: null,
    salesFollowUpBlockReason: null,
    commerciallyCommitted: false,
    officiallyBooked: false,
  };
}

/**
 * Whether a specific workflow intent may proceed given current lifecycle.
 * answer_questions remains allowed after commitment when purpose-built.
 */
export function isIntentEligibleForLifecycle(
  intent: FollowUpWorkflowIntent,
  decision: RelationshipLifecycleDecision,
): boolean {
  if (decision.salesFollowUpAllowed) return true;
  if (POST_COMMITMENT_ALLOWED_INTENTS.has(intent)) return true;
  if (isSalesFollowUpIntent(intent)) return false;
  return false;
}

export type LifecycleDraftContext = {
  workflowIntent?: FollowUpWorkflowIntent | string | null;
  communicationPurpose?: string | null;
  lifecycleWithdrawal?: {
    withdrawnAt: string;
    reasonCode: string;
    reason: string;
  } | null;
};

export function draftHasLifecycleWithdrawal(
  context: LifecycleDraftContext | null | undefined,
): boolean {
  return Boolean(context?.lifecycleWithdrawal?.withdrawnAt);
}

/**
 * Pending sales follow-up drafts become non-actionable when lifecycle supersedes them.
 * Does not delete; caller stamps context.lifecycleWithdrawal.
 */
export function shouldWithdrawSalesFollowUpDraft(input: {
  draftType?: string | null;
  context?: LifecycleDraftContext | null;
  decision: RelationshipLifecycleDecision;
}): { withdraw: boolean; reasonCode: string | null; reason: string | null } {
  if (draftHasLifecycleWithdrawal(input.context)) {
    return {
      withdraw: false,
      reasonCode: input.context?.lifecycleWithdrawal?.reasonCode ?? null,
      reason: input.context?.lifecycleWithdrawal?.reason ?? null,
    };
  }
  const draftType = input.draftType ?? "follow_up_email";
  if (draftType !== "follow_up_email" && draftType !== "follow_up_text") {
    return { withdraw: false, reasonCode: null, reason: null };
  }
  const intent = (input.context?.workflowIntent ?? "gentle_check_in") as FollowUpWorkflowIntent;
  const purpose = input.context?.communicationPurpose ?? "none";
  if (purpose === "unresolved_question" || purpose === "explicit_request") {
    if (intent === "answer_questions") {
      return { withdraw: false, reasonCode: null, reason: null };
    }
  }
  if (!isIntentEligibleForLifecycle(intent, input.decision)) {
    return {
      withdraw: true,
      reasonCode: input.decision.salesFollowUpBlockReasonCode,
      reason: input.decision.salesFollowUpBlockReason,
    };
  }
  return { withdraw: false, reasonCode: null, reason: null };
}

/** Compatibility helper — same supersession rule used by dashboard observations. */
export function salesTourFollowUpSuperseded(facts: {
  booked: boolean;
  lost: boolean;
  contractSigned: boolean;
  paymentReceived: boolean;
}): boolean {
  const decision = resolveRelationshipLifecycle({
    firstBookedAt: facts.booked ? "booked" : null,
    lostAt: facts.lost ? "lost" : null,
    contractSigned: facts.contractSigned,
    paymentReceived: facts.paymentReceived,
  });
  return !decision.salesFollowUpAllowed;
}
