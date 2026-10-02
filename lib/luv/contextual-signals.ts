/**
 * Luv contextual intelligence (S1–S4) — pure evaluators.
 *
 * WHAT + WHY + NEXT. L3 only. No Dashboard L1 promotion.
 * S5 is explicitly out of scope for this workstream.
 */

import type { LuvObservation } from "@/lib/luv/types";
import { hasQualifyingCustomerContact } from "@/lib/luv/observation-quality";

export const CONTEXTUAL_EVENT_WINDOW_DAYS = 21;
export const UNATTENDED_INQUIRY_HOURS = 48;

export type ContextualEvent = {
  id: string;
  venueId: string;
  name: string;
  eventDate: string; // YYYY-MM-DD
  status: string;
  clientId: string | null;
};

export type ContextualContract = {
  id: string;
  venueId: string;
  title: string;
  status: string;
  sentAt: string | null;
  eventId: string | null;
  clientId: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
};

export type ContextualPaymentAttention = {
  eventId: string;
  venueId: string;
  /** From computePaymentsReadiness — only needs_attention qualifies. */
  status: "needs_attention" | "waiting" | "complete" | "not_started" | string;
  detail: string;
  href: string;
};

export type ContextualLead = {
  id: string;
  venueId: string;
  firstName: string;
  lastName: string;
  /** Weak journey metadata only — never proof of contact or action. */
  salesStage: string;
  createdAt: string;
  lastContactedAt: string | null;
  hasCustomerFacingMessage?: boolean;
  tourStatus?: string | null;
  firstBookedAt?: string | null;
  lostAt?: string | null;
};

export type ContextualTour = {
  id: string;
  venueId: string;
  scheduledAt: string;
  contactName: string | null;
  durationMinutes: number;
  leadId: string | null;
};

export type ContextualTourLeadPrep = {
  leadId: string;
  venueId: string;
  nextActionText: string | null;
  nextActionDue: string | null; // YYYY-MM-DD
  lastContactedAt: string | null;
  salesStage: string;
};

export type ContextualEvalOpts = {
  venueId: string;
  /** Injectable clock for boundary tests. */
  nowMs?: number;
};

function daysUntilEventDate(eventDate: string, nowMs: number): number {
  const eventMs = new Date(`${eventDate}T12:00:00`).getTime();
  return Math.round((eventMs - nowMs) / 86_400_000);
}

function inDaysPhrase(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

function leadDisplayName(lead: Pick<ContextualLead, "firstName" | "lastName">): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "This inquiry";
}

function clientDisplayName(c: ContextualContract): string | null {
  const name = [c.clientFirstName, c.clientLastName].filter(Boolean).join(" ");
  return name || null;
}

/** Calendar-day window: 0..21 inclusive qualifies; 22+ does not. */
export function isWithinEventWindow(eventDate: string, opts: ContextualEvalOpts): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const days = daysUntilEventDate(eventDate, nowMs);
  return days >= 0 && days <= CONTEXTUAL_EVENT_WINDOW_DAYS;
}

export function isUnattendedInquiryAge(createdAt: string, opts: ContextualEvalOpts): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return false;
  return nowMs - createdMs >= UNATTENDED_INQUIRY_HOURS * 3_600_000;
}

/**
 * S4 evidence — only a genuine open next action the coordinator set.
 * Null last_contacted_at is NOT "no contact": confirmation emails and
 * conversation_messages are authoritative. A scheduled tour is itself
 * contact evidence. "Make first contact" is retired.
 */
export function tourPreparationEvidence(
  tour: ContextualTour,
  lead: ContextualTourLeadPrep | null,
  opts: ContextualEvalOpts,
): { kind: "next_action"; detail: string } | null {
  if (!lead || lead.venueId !== opts.venueId) return null;
  if (tour.venueId !== opts.venueId) return null;
  if (!tour.leadId || tour.leadId !== lead.leadId) return null;

  // last_contacted_at / sales_stage never qualify as a prep gap.
  return null;
}

export function buildS1EventContractObservation(
  event: ContextualEvent,
  contract: ContextualContract,
  opts: ContextualEvalOpts,
): LuvObservation | null {
  if (event.venueId !== opts.venueId || contract.venueId !== opts.venueId) return null;
  if (event.status === "cancelled" || event.status === "complete") return null;
  if (contract.status !== "sent" || !contract.sentAt) return null;
  if (contract.eventId !== event.id) return null;
  if (!isWithinEventWindow(event.eventDate, opts)) return null;

  const nowMs = opts.nowMs ?? Date.now();
  const days = daysUntilEventDate(event.eventDate, nowMs);
  const who = clientDisplayName(contract);
  const contractLabel = who ? `${who}'s contract` : `"${contract.title}"`;

  return {
    id: `event-contract-unsigned-${contract.id}`,
    kind: "risk",
    priority: days <= 7 ? "high" : "medium",
    message: `${event.name} is ${inDaysPhrase(days)}, and ${contractLabel} is still awaiting signature.`,
    detail: "Without a signed agreement, final planning and payment steps for this booking stay blocked.",
    link: `/contracts/${contract.id}`,
    actionLabel: "Open Contract →",
    daysUntil: days,
    recommendation: {
      label: "Follow up on the signature",
      link: `/contracts/${contract.id}`,
      type: "navigate",
    },
  };
}

export function buildS2EventPaymentObservation(
  event: ContextualEvent,
  payment: ContextualPaymentAttention,
  opts: ContextualEvalOpts,
): LuvObservation | null {
  if (event.venueId !== opts.venueId || payment.venueId !== opts.venueId) return null;
  if (payment.eventId !== event.id) return null;
  if (event.status === "cancelled" || event.status === "complete") return null;
  if (payment.status !== "needs_attention") return null;
  if (!isWithinEventWindow(event.eventDate, opts)) return null;

  const nowMs = opts.nowMs ?? Date.now();
  const days = daysUntilEventDate(event.eventDate, nowMs);

  return {
    id: `event-payment-attention-${event.id}`,
    kind: "risk",
    priority: days <= 7 ? "high" : "medium",
    message: `${event.name} is ${inDaysPhrase(days)}, and a payment still needs attention.`,
    detail: payment.detail,
    link: payment.href,
    actionLabel: "Review Payment →",
    daysUntil: days,
    recommendation: {
      label: "Review the payment",
      link: payment.href,
      type: "navigate",
    },
  };
}

export function buildS3UnattendedInquiryObservation(
  lead: ContextualLead,
  opts: ContextualEvalOpts,
): LuvObservation | null {
  if (lead.venueId !== opts.venueId) return null;
  if (lead.firstBookedAt) return null;
  if (lead.lostAt) return null;
  if (hasQualifyingCustomerContact({
    lastContactedAt: lead.lastContactedAt,
    hasCustomerFacingMessage: lead.hasCustomerFacingMessage,
    tourStatus: lead.tourStatus,
  })) return null;
  if (!isUnattendedInquiryAge(lead.createdAt, opts)) return null;

  const name = leadDisplayName(lead);
  const ageHours = Math.floor(
    ((opts.nowMs ?? Date.now()) - Date.parse(lead.createdAt)) / 3_600_000,
  );

  return {
    id: `inquiry-unattended-${lead.id}`,
    kind: "risk",
    priority: ageHours >= 72 ? "high" : "medium",
    message: `${name} reached out ${ageHours >= 48 ? "over 48 hours" : `${ageHours} hours`} ago and has not been contacted yet.`,
    detail: "This inquiry has no recorded contact — they may still be waiting for a first response.",
    link: `/leads/${lead.id}`,
    actionLabel: "Open Lead →",
    recommendation: {
      label: "Reach out to this inquiry",
      link: `/leads/${lead.id}?luv=follow_up_email`,
      type: "draft",
    },
  };
}

/**
 * S4 — evidence-based tour prep. Returns null when there is no real gap
 * (caller should keep / omit the generic tour-upcoming observation separately).
 */
export function buildS4TourPrepObservation(
  tour: ContextualTour,
  lead: ContextualTourLeadPrep | null,
  opts: ContextualEvalOpts,
  venueLocalTimeLabel: string,
): LuvObservation | null {
  if (tour.venueId !== opts.venueId) return null;
  const evidence = tourPreparationEvidence(tour, lead, opts);
  if (!evidence) return null;

  const name = tour.contactName ?? "A prospective client";
  const href = tour.leadId ? `/leads/${tour.leadId}` : "/leads";

  return {
    id: `tour-upcoming-${tour.id}`,
    kind: "recommendation",
    priority: "medium",
    message: `${name}'s tour is ${venueLocalTimeLabel} — preparation is still incomplete.`,
    detail: evidence.detail,
    link: href,
    actionLabel: "Open Lead →",
    recommendation: {
      label: "Complete the open next action",
      link: href,
      type: "navigate",
    },
  };
}

/** Suppress legacy age-only contract cards when S1 covers the same contract. */
export function shouldSuppressLegacyContractObservation(
  observationId: string,
  activeS1ContractIds: ReadonlySet<string>,
): boolean {
  if (!observationId.startsWith("contract-")) return false;
  if (observationId.startsWith("contract-expiry-")) return false;
  const contractId = observationId.slice("contract-".length);
  return activeS1ContractIds.has(contractId);
}

/** Suppress legacy followup-* when S3 covers the same lead. */
export function shouldSuppressLegacyFollowupObservation(
  observationId: string,
  activeS3LeadIds: ReadonlySet<string>,
): boolean {
  if (!observationId.startsWith("followup-")) return false;
  const leadId = observationId.slice("followup-".length);
  return activeS3LeadIds.has(leadId);
}

export function applyContextualSupersession(
  observations: LuvObservation[],
): LuvObservation[] {
  const s1ContractIds = new Set<string>();
  const s3LeadIds = new Set<string>();
  for (const obs of observations) {
    if (obs.id.startsWith("event-contract-unsigned-")) {
      s1ContractIds.add(obs.id.slice("event-contract-unsigned-".length));
    }
    if (obs.id.startsWith("inquiry-unattended-")) {
      s3LeadIds.add(obs.id.slice("inquiry-unattended-".length));
    }
  }
  return observations.filter(
    (obs) =>
      !shouldSuppressLegacyContractObservation(obs.id, s1ContractIds) &&
      !shouldSuppressLegacyFollowupObservation(obs.id, s3LeadIds),
  );
}

/** Record-surface filter: keep observations that address this lead/event/contract/invoice. */
export function filterObservationsForRecord(
  observations: readonly LuvObservation[],
  record: {
    leadId?: string;
    eventId?: string;
    contractId?: string;
    contractIds?: readonly string[];
    clientId?: string;
    invoiceId?: string;
  },
): LuvObservation[] {
  const contractIds = new Set<string>([
    ...(record.contractId ? [record.contractId] : []),
    ...(record.contractIds ?? []),
  ]);
  return observations.filter((obs) => {
    const href = `${obs.link} ${obs.recommendation?.link ?? ""}`;
    if (record.leadId) {
      if (obs.id === `inquiry-unattended-${record.leadId}`) return true;
      if (obs.id.startsWith("tour-upcoming-") && href.includes(`/leads/${record.leadId}`)) return true;
      if (href.includes(`/leads/${record.leadId}`)) return true;
    }
    if (record.eventId) {
      if (obs.id === `event-payment-attention-${record.eventId}`) return true;
      if (href.includes(`/events/${record.eventId}`)) return true;
    }
    for (const contractId of contractIds) {
      if (obs.id === `event-contract-unsigned-${contractId}`) return true;
      if (href.includes(`/contracts/${contractId}`)) return true;
    }
    if (record.clientId && href.includes(`/clients/${record.clientId}`)) return true;
    if (record.invoiceId && href.includes(`/invoices/${record.invoiceId}`)) return true;
    return false;
  });
}
