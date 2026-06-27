/**
 * Contract merge fields and default template (Sprint 15).
 */

export type MergeFieldMeta = {
  key: string;
  label: string;
  description: string;
};

export const MERGE_FIELDS: MergeFieldMeta[] = [
  { key: "venue_name",            label: "Venue Name",          description: "Your venue's name" },
  { key: "couple_name",           label: "Couple Name",         description: "Full couple name (e.g., Emily & James Carter)" },
  { key: "primary_contact_name",  label: "Primary Contact",     description: "First person's full name" },
  { key: "event_date",            label: "Event Date",          description: "Formatted event date (e.g., June 12, 2027)" },
  { key: "event_type",            label: "Event Type",          description: "Type of event (e.g., Wedding)" },
  { key: "guest_count",           label: "Guest Count",         description: "Number of guests" },
  { key: "today_date",            label: "Today's Date",        description: "The date this contract is generated" },
  { key: "contract_title",        label: "Contract Title",      description: "The title of this contract" },
];

/** Starter template that ships with every new venue. */
export const DEFAULT_TEMPLATE_CONTENT = `VENUE RENTAL AGREEMENT

This Venue Rental Agreement ("Agreement") is entered into as of {{today_date}} between:

VENUE
{{venue_name}}

CLIENT
{{couple_name}}

────────────────────────────────────────────────────────────────
EVENT DETAILS
────────────────────────────────────────────────────────────────
Event Type:     {{event_type}}
Event Date:     {{event_date}}
Guest Count:    {{guest_count}}

────────────────────────────────────────────────────────────────
TERMS AND CONDITIONS
────────────────────────────────────────────────────────────────

1. RESERVATION
This Agreement confirms the exclusive reservation of {{venue_name}} for the event described above. The venue will not host other events during the reserved period without the Client's prior written consent.

2. CLIENT RESPONSIBILITIES
The Client agrees to:
- Take reasonable care of the venue and its contents.
- Ensure all guests comply with venue rules and regulations.
- Be responsible for any damage caused by the Client or their guests.
- Provide a final guest count no later than 30 days before the event.

3. VENUE RESPONSIBILITIES
{{venue_name}} agrees to:
- Provide the venue in clean, operational condition on the event date.
- Have staff available during the event to assist as needed.
- Notify the Client immediately of any circumstances that may affect the event.

4. CANCELLATION POLICY
Should the Client need to cancel this Agreement, please contact {{venue_name}} immediately. Cancellation policies and any applicable fees will be outlined in the addendum to this Agreement.

5. INSURANCE
The Client is responsible for obtaining any required event insurance. {{venue_name}} may require proof of insurance prior to the event date.

6. GENERAL CONDITIONS
This Agreement is governed by applicable law. Any disputes arising under this Agreement shall be resolved by mutual agreement, or if necessary, through binding arbitration.

7. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, warranties, and understandings. Amendments must be in writing and signed by both parties.

────────────────────────────────────────────────────────────────
SIGNATURES
────────────────────────────────────────────────────────────────

VENUE REPRESENTATIVE
Signature: ________________________________
Date: {{today_date}}

CLIENT
I, the undersigned, agree to the terms and conditions set forth in this Agreement.

Signature: ________________________________
Printed Name: _____________________________
Date: _____________________________________
`;

export const DEFAULT_TEMPLATE_NAME = "Standard Venue Rental Agreement";
export const DEFAULT_TEMPLATE_DESCRIPTION =
  "A professional venue rental agreement covering reservation, responsibilities, cancellation, and signatures.";

export function formatContractDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}
