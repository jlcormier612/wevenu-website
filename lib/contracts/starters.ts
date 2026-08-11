/**
 * Hello to Cheers — Wedding Venue Agreement starter (CTR-01).
 *
 * LEGAL SAFETY: Do not invent cancellation, liability, insurance, alcohol,
 * force majeure, dispute, governing-law, or other legally consequential
 * policy language. Venue-owned sections use explicit placeholders.
 *
 * Masters are code fixtures. Venue Library copies are independent rows.
 */

import { extractTokens } from "@/lib/shared-merge/tokens";

export const CONTRACT_STARTER_MASTER_KEY = "CTR-01" as const;
export type ContractStarterMasterKey = typeof CONTRACT_STARTER_MASTER_KEY;

/** Distinctive phrase used to detect untouched venue-policy placeholders. */
export const VENUE_POLICY_PLACEHOLDER_MARKER = "Add your venue's approved";

export const WEDDING_VENUE_AGREEMENT_NAME = "Wedding Venue Agreement";
export const WEDDING_VENUE_AGREEMENT_DESCRIPTION =
  "A professionally structured starting point for your venue agreement. Add your venue's approved policies and terms, then customize it to make it your own.";

/**
 * Starter body. Tokens use real supported merge fields.
 * Policy sections deliberately use the same "Add your venue's approved … here."
 * pattern so send-time safety can block untouched placeholders.
 */
export const WEDDING_VENUE_AGREEMENT_CONTENT = `Wedding Venue Agreement

This Agreement is between {{venue_name}} and {{client_name}} for the celebration described below.

The purpose of this Agreement is to document the services, spaces, event details, payment arrangements, and responsibilities agreed upon by the parties.

────────────────────────────────
CLIENT & EVENT DETAILS
────────────────────────────────
Venue
{{venue_name}}
{{venue_address}}
{{venue_phone}}
{{venue_email}}

Client
{{client_name}}
{{client_email}}
{{client_phone}}

Event
{{event_name}}
Event Date: {{event_date}}
Event Type: {{event_type}}
Guest Count: {{guest_count}}
Event Spaces: {{event_spaces}}
Coordinator: {{coordinator_name}}

────────────────────────────────
EVENT SCHEDULE
────────────────────────────────
Event Date
{{event_date}}

Venue Access / Event Hours
{{venue_access_hours}}

Ceremony
{{ceremony_summary}}

Reception
{{reception_summary}}

Event Spaces
{{event_spaces}}

────────────────────────────────
VENUE & EVENT SPACES
────────────────────────────────
The event will take place at {{venue_name}} using the spaces included in the booking.

{{event_spaces}}

────────────────────────────────
SERVICES & PACKAGE
────────────────────────────────
{{package_section}}

────────────────────────────────
INCLUDED ITEMS & SERVICES
────────────────────────────────
Included
{{included_items_summary}}

Additional / Optional
{{additional_items_summary}}

────────────────────────────────
PAYMENT SCHEDULE
────────────────────────────────
{{payment_schedule_summary}}

Total contracted amount
{{contract_total}}

Balance
{{balance_remaining}}

────────────────────────────────
VENUE POLICIES
────────────────────────────────
Cancellation & Rescheduling
Venue policy
Add your venue's approved cancellation and rescheduling policy here.

Payment & Late Payment
Venue policy
Add your venue's approved payment and late-payment terms here.

Guest Count & Final Details
Venue policy
Add your venue's approved guest-count and final-details requirements here.

Event Changes
Venue policy
Add your venue's approved policy for changes to event details, services, spaces, or package selections here.

────────────────────────────────
CLIENT RESPONSIBILITIES
────────────────────────────────
Add your venue's approved client responsibilities and requirements here.

────────────────────────────────
VENUE RESPONSIBILITIES
────────────────────────────────
Add your venue's approved description of venue responsibilities and included services here.

────────────────────────────────
VENDORS & OUTSIDE SERVICES
────────────────────────────────
Add your venue's approved vendor and outside-service policy here.

{{vendors_on_file}}

────────────────────────────────
FOOD & BEVERAGE
────────────────────────────────
Add your venue's approved food and beverage requirements, catering policy, and related terms here.

────────────────────────────────
ALCOHOL
────────────────────────────────
Add your venue's approved alcohol policy and requirements here.

────────────────────────────────
DECOR, SETUP & PROPERTY
────────────────────────────────
Add your venue's approved decor, setup, cleanup, property-care, and damage terms here.

────────────────────────────────
INSURANCE
────────────────────────────────
Add your venue's approved insurance requirements here.

────────────────────────────────
EVENT-DAY REQUIREMENTS
────────────────────────────────
Add your venue's approved event-day requirements and procedures here.

────────────────────────────────
CANCELLATION & TERMINATION
────────────────────────────────
Add your venue's approved cancellation and termination language here.

────────────────────────────────
FORCE MAJEURE / UNFORESEEN CIRCUMSTANCES
────────────────────────────────
Add your venue's approved force majeure or unforeseen-circumstances language here.

────────────────────────────────
DISPUTE RESOLUTION
────────────────────────────────
Add your venue's approved dispute-resolution language here.

────────────────────────────────
GOVERNING LAW
────────────────────────────────
Add your venue's approved governing-law language here.

────────────────────────────────
ADDITIONAL TERMS
────────────────────────────────
Add any additional venue-approved terms that apply to this agreement here.

────────────────────────────────
ACKNOWLEDGMENT
────────────────────────────────
By signing this Agreement, the parties acknowledge that they have reviewed the information and terms presented in this Agreement and intend to enter into the agreement represented by this document.

────────────────────────────────
SIGNATURES
────────────────────────────────
Client
{{client_name}}

Signature: ________________________________
Date: ____________________________________

Venue
{{venue_name}}

Authorized Representative: ________________
Signature: ________________________________
Date: {{today_date}}
`;

export type ContractStarterMaster = {
  key: ContractStarterMasterKey;
  name: string;
  description: string;
  content: string;
  isDefault: boolean;
};

export const CONTRACT_STARTER_MASTERS: readonly ContractStarterMaster[] = [
  {
    key: CONTRACT_STARTER_MASTER_KEY,
    name: WEDDING_VENUE_AGREEMENT_NAME,
    description: WEDDING_VENUE_AGREEMENT_DESCRIPTION,
    content: WEDDING_VENUE_AGREEMENT_CONTENT,
    isDefault: true,
  },
];

export function getContractStarterMaster(key: string): ContractStarterMaster | undefined {
  return CONTRACT_STARTER_MASTERS.find((m) => m.key === key);
}

/** Detect untouched venue-policy placeholder sentences. */
export function findUntouchedPolicyPlaceholders(content: string): string[] {
  const matches = content.match(
    new RegExp(`${VENUE_POLICY_PLACEHOLDER_MARKER}[^.\\n]*\\.`, "gi"),
  );
  return matches ? [...new Set(matches.map((m) => m.trim()))] : [];
}

export function assertCustomerSafeContractContent(
  content: string,
): { ok: true } | { ok: false; message: string; unresolvedTokens: string[]; placeholders: string[] } {
  const unresolvedTokens = extractTokens(content);
  const placeholders = findUntouchedPolicyPlaceholders(content);

  if (unresolvedTokens.length === 0 && placeholders.length === 0) {
    return { ok: true };
  }

  const parts: string[] = [];
  if (unresolvedTokens.length > 0) {
    parts.push(`Unresolved details still need values: ${unresolvedTokens.map((t) => `{{${t}}}`).join(", ")}.`);
  }
  if (placeholders.length > 0) {
    parts.push(
      "This agreement still contains starter policy placeholders. Replace them with your venue's approved language before sending to a client.",
    );
  }
  return {
    ok: false,
    message: parts.join(" "),
    unresolvedTokens,
    placeholders,
  };
}
