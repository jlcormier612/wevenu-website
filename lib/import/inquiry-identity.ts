/**
 * Shared Lead inquiry identity and retry rules.
 *
 * HQ White-Glove, self-service Bring Your Business, and the import preview
 * must all use this module. Same person + different preferred dates are
 * distinct inquiries. Same person + same inquiry identity is a retry.
 * Email alone is never conclusive identity.
 */

import {
  classifyPersonMatch,
  classifyPersonMatchFromCandidates,
  type PersonMatchCandidate,
  type PersonMatchDecision,
} from "@/lib/import/match-policy";

function norm(value: string | number | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function preferredDate(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, 10);
}

export type LeadInquiryIdentity = {
  firstName: string;
  lastName: string;
  email?: string | null;
  eventDate?: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  eventType?: string | null;
  guestCount?: string | number | null;
  source?: string | null;
  originalSourceLabel?: string | null;
  inquiryMessage?: string | null;
  followUpDate?: string | null;
  nextActionText?: string | null;
  dateFlexibility?: string | null;
  salesStage?: string | null;
};

export type LeadInquiryDisposition = "retry" | "additional" | "new" | "uncertain";

export type LeadImportMatch = PersonMatchDecision & {
  inquiryDisposition: LeadInquiryDisposition;
};

/**
 * Blank-date policy (deterministic):
 *
 * - Preferred date present: inquiry identity is exact person (name + email)
 *   plus that date. Different dates are distinct inquiries. The same date is
 *   a retry.
 * - Preferred date blank: do not treat every same-person blank-date row as a
 *   duplicate. Distinguish by a fingerprint of source, inquiry notes, partner
 *   names, event type, guest count, follow-up date, next action, and date
 *   flexibility. Identical fingerprint = retry. Any differing field = a
 *   separate inquiry that must be preserved.
 * - Blank date and empty fingerprint (no distinguishing details at all):
 *   retry. There is no safe signal they are different inquiries, so we skip
 *   rather than invent copies.
 * - Same email + different names: not an inquiry identity match. Person match
 *   is "likely" and defaults to Skip.
 * - Booked / lost / cancelled leads are not retries of an unbooked inquiry.
 *   Callers must pass only active inquiries. Lead import never books.
 */
export function leadInquiryRetryKey(input: LeadInquiryIdentity): string {
  const person = `${norm(input.firstName)}|${norm(input.lastName)}|${norm(input.email)}`;
  const date = preferredDate(input.eventDate);
  if (date) return `${person}|date:${date}`;
  const source = norm(input.originalSourceLabel) || norm(input.source);
  const fingerprint = [
    `src:${source}`,
    `msg:${norm(input.inquiryMessage)}`,
    `pf:${norm(input.partnerFirstName)}`,
    `pl:${norm(input.partnerLastName)}`,
    `et:${norm(input.eventType)}`,
    `gc:${norm(input.guestCount)}`,
    `fu:${preferredDate(input.followUpDate)}`,
    `na:${norm(input.nextActionText)}`,
    `df:${norm(input.dateFlexibility)}`,
    `st:${norm(input.salesStage)}`,
  ].join("|");
  return `${person}|date:|fp:${fingerprint}`;
}

export function isLeadInquiryRetry(
  incoming: LeadInquiryIdentity,
  existing: readonly LeadInquiryIdentity[],
): boolean {
  const incomingKey = leadInquiryRetryKey(incoming);
  return existing.some((row) => leadInquiryRetryKey(row) === incomingKey);
}

export function exactPersonInquiries(
  incoming: LeadInquiryIdentity,
  existing: readonly LeadInquiryIdentity[],
): LeadInquiryIdentity[] {
  const person = `${norm(incoming.firstName)}|${norm(incoming.lastName)}|${norm(incoming.email)}`;
  return existing.filter(
    (row) => `${norm(row.firstName)}|${norm(row.lastName)}|${norm(row.email)}` === person,
  );
}

export function classifyLeadImportMatch(
  person: PersonMatchDecision,
  incoming: LeadInquiryIdentity,
  existingInquiries: readonly LeadInquiryIdentity[],
): LeadImportMatch {
  if (person.kind === "likely") {
    return { ...person, inquiryDisposition: "uncertain" };
  }
  if (person.kind === "new") {
    return { ...person, inquiryDisposition: "new" };
  }
  const ownInquiries = exactPersonInquiries(incoming, existingInquiries);
  if (isLeadInquiryRetry(incoming, ownInquiries)) {
    return {
      ...person,
      defaultAction: "skip",
      reason: "This inquiry is already in Hello to Cheers. No second Lead will be created.",
      inquiryDisposition: "retry",
    };
  }
  return {
    ...person,
    defaultAction: "create_new",
    reason: incoming.eventDate?.trim()
      ? "Same person, additional inquiry with a different preferred date. A new Lead will be created; no booking is made."
      : "Same person, additional inquiry with different details. A new Lead will be created; no booking is made.",
    inquiryDisposition: "additional",
  };
}

export function classifyLeadRowAgainstKnownPeople(
  incoming: LeadInquiryIdentity,
  dbPerson: PersonMatchDecision,
  dbInquiries: readonly LeadInquiryIdentity[],
  priorPeople: readonly PersonMatchCandidate[],
  priorInquiries: readonly LeadInquiryIdentity[],
): LeadImportMatch {
  const filePerson = classifyPersonMatchFromCandidates(incoming, priorPeople);
  const person = dbPerson.kind !== "new" ? dbPerson : filePerson;
  const inquiries = [
    ...dbInquiries,
    ...exactPersonInquiries(incoming, priorInquiries),
  ];
  return classifyLeadImportMatch(person, incoming, inquiries);
}

export function personMatchCandidateFromInquiry(
  id: string,
  incoming: LeadInquiryIdentity,
): PersonMatchCandidate {
  return {
    id,
    firstName: incoming.firstName,
    lastName: incoming.lastName,
    email: incoming.email ?? null,
  };
}

/** Clients: same person + same event date is a within-file retry. Email alone is not. */
export function clientEventWithinFileKey(
  firstName: string,
  lastName: string,
  email: string | null | undefined,
  eventDate: string | null | undefined,
): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  return `${norm(firstName)}|${norm(lastName)}|email:${e}|${preferredDate(eventDate)}`;
}

export function leadInquiryIdentityFromInput(input: LeadInquiryIdentity): LeadInquiryIdentity {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? "",
    eventDate: preferredDate(input.eventDate),
    partnerFirstName: input.partnerFirstName ?? "",
    partnerLastName: input.partnerLastName ?? "",
    eventType: input.eventType ?? "",
    guestCount: input.guestCount ?? "",
    source: input.source ?? "",
    originalSourceLabel: input.originalSourceLabel ?? "",
    inquiryMessage: input.inquiryMessage ?? "",
    followUpDate: preferredDate(input.followUpDate),
    nextActionText: input.nextActionText ?? "",
    dateFlexibility: input.dateFlexibility ?? "",
    salesStage: input.salesStage ?? "",
  };
}

export function leadInquirySkipMessage(match: LeadImportMatch): string {
  if (match.inquiryDisposition === "retry") {
    return "This inquiry is already in Hello to Cheers. No second Lead was created.";
  }
  if (match.kind === "likely") {
    return `Left out for review — ${match.reason}`;
  }
  return match.reason?.trim() ? match.reason : "Left out of this import.";
}

/** Re-export so lead callers can classify a person without a second policy. */
export { classifyPersonMatch };
