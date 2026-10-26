import type { NormalizedLeadInput, RawIntakeInput } from "@/lib/lead-intake/types";
import { normalizeVenuePhoneInput } from "@/lib/sms/phone";

function cleanString(v: string | null | undefined): string | null {
  const trimmed = v?.trim();
  return trimmed ? trimmed : null;
}

/** Shared Normalize stage — the one implementation every source's output passes through. */
export function normalizeLeadInput(input: RawIntakeInput): NormalizedLeadInput {
  // Same storage shape as manual lead create/update (normalizeVenuePhoneInput):
  // US/Canada → "(NXX) NXX-XXXX"; unparseable values trimmed, never invented.
  const phoneNormalized = normalizeVenuePhoneInput(input.phone);
  return {
    firstName: input.firstName?.trim() ?? "",
    lastName: input.lastName?.trim() ?? "",
    email: cleanString(input.email)?.toLowerCase() ?? null,
    phone: phoneNormalized || null,
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
