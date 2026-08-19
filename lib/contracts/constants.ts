/**
 * Contract merge fields metadata (editor picker) and legacy name aliases.
 * Starter body: lib/contracts/starters.ts
 */

import {
  WEDDING_VENUE_AGREEMENT_CONTENT,
  WEDDING_VENUE_AGREEMENT_DESCRIPTION,
  WEDDING_VENUE_AGREEMENT_NAME,
} from "@/lib/contracts/starters";

export type MergeFieldMeta = {
  key: string;
  label: string;
  description: string;
};

export const MERGE_FIELDS: MergeFieldMeta[] = [
  { key: "venue_name", label: "Venue Name", description: "Your venue's name" },
  { key: "venue_address", label: "Venue Address", description: "Address on your venue profile" },
  { key: "venue_phone", label: "Venue Phone", description: "Phone on your venue profile" },
  { key: "venue_email", label: "Venue Email", description: "Email on your venue profile" },
  { key: "client_name", label: "Client Name", description: "Couple / client display name" },
  { key: "couple_name", label: "Client Name (alias)", description: "Same as client_name — kept for older templates" },
  { key: "primary_contact_name", label: "Primary Contact", description: "First person's full name" },
  { key: "first_name", label: "First Name", description: "The primary client's first name only" },
  { key: "last_name", label: "Last Name", description: "The primary client's last name only" },
  { key: "client_email", label: "Client Email", description: "Email on the client record" },
  { key: "client_phone", label: "Client Phone", description: "Phone on the client record" },
  { key: "event_name", label: "Event Name", description: "Name of the celebration" },
  { key: "event_date", label: "Event Date", description: "Formatted event date" },
  { key: "event_type", label: "Event Type", description: "Type of event" },
  { key: "guest_count", label: "Guest Count", description: "Number of guests" },
  { key: "event_spaces", label: "Event Spaces", description: "Spaces on the booking" },
  { key: "coordinator_name", label: "Coordinator", description: "Venue coordinator / owner name" },
  { key: "venue_access_hours", label: "Access / Hours", description: "Event access window from the booking" },
  { key: "ceremony_summary", label: "Ceremony", description: "Known ceremony context" },
  { key: "reception_summary", label: "Reception", description: "Known reception context" },
  { key: "package_section", label: "Package", description: "Selected package summary" },
  { key: "included_items_summary", label: "Included Items", description: "Included services/items" },
  { key: "additional_items_summary", label: "Additional Items", description: "Additional / optional items" },
  { key: "payment_schedule_summary", label: "Payment Schedule", description: "Payment plan lines" },
  { key: "contract_total", label: "Contract Total", description: "Total contracted amount" },
  { key: "balance_remaining", label: "Balance", description: "Remaining balance" },
  { key: "vendors_on_file", label: "Vendors", description: "Vendors currently on the event" },
  { key: "today_date", label: "Today's Date", description: "Date the agreement is generated" },
  { key: "contract_title", label: "Contract Title", description: "Title of this agreement" },
];

/** @deprecated Use Wedding Venue Agreement starter — kept as re-export name for older imports. */
export const DEFAULT_TEMPLATE_CONTENT = WEDDING_VENUE_AGREEMENT_CONTENT;
export const DEFAULT_TEMPLATE_NAME = WEDDING_VENUE_AGREEMENT_NAME;
export const DEFAULT_TEMPLATE_DESCRIPTION = WEDDING_VENUE_AGREEMENT_DESCRIPTION;

export function formatContractDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}
