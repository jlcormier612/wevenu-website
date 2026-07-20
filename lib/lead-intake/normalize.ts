import type { NormalizedLeadInput, RawIntakeInput } from "@/lib/lead-intake/types";

function cleanString(v: string | null | undefined): string | null {
  const trimmed = v?.trim();
  return trimmed ? trimmed : null;
}

/** Shared Normalize stage — the one implementation every source's output passes through. */
export function normalizeLeadInput(input: RawIntakeInput): NormalizedLeadInput {
  return {
    firstName: input.firstName?.trim() ?? "",
    lastName: input.lastName?.trim() ?? "",
    email: cleanString(input.email)?.toLowerCase() ?? null,
    phone: cleanString(input.phone),
    partnerFirstName: cleanString(input.partnerFirstName),
    partnerLastName: cleanString(input.partnerLastName),
    partnerEmail: cleanString(input.partnerEmail)?.toLowerCase() ?? null,
    eventType: cleanString(input.eventType),
    eventDate: cleanString(input.eventDate),
    endDate: cleanString(input.endDate),
    guestCount: input.guestCount ?? null,
    estimatedBudget: input.estimatedBudget && input.estimatedBudget > 0 ? input.estimatedBudget : null,
    inquiryMessage: cleanString(input.inquiryMessage),
    inquiryDate: cleanString(input.inquiryDate),
    confidenceScore: input.confidenceScore ?? null,
    sourceData: input.sourceData ?? {},
  };
}
