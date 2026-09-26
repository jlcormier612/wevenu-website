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

/**
 * Standard Contract Builder Smart Fields — values with a legitimate
 * source of truth at contract author/send time (or an honest fallback when
 * that source is not yet filled). Vendor lists remain deferred.
 */
export const MERGE_FIELDS: MergeFieldMeta[] = [
  { key: "venue_name", label: "Venue Name", description: "Your venue's name" },
  { key: "venue_address", label: "Venue Address", description: "Address on your venue profile" },
  { key: "venue_phone", label: "Venue Phone", description: "Phone on your venue profile" },
  { key: "venue_email", label: "Venue Email", description: "Email on your venue profile" },
  {
    key: "client_name",
    label: "Client Name",
    description:
      "Selected required client signer(s) on this contract — one name, or multiple joined with &",
  },
  { key: "first_name", label: "First Name", description: "Primary client contact's first name" },
  { key: "last_name", label: "Last Name", description: "Primary client contact's last name" },
  { key: "client_email", label: "Client Email", description: "Email on the client record" },
  { key: "client_phone", label: "Client Phone", description: "Phone on the client record" },
  { key: "event_name", label: "Event Name", description: "Name of the celebration" },
  { key: "event_date", label: "Event Date", description: "Formatted event date" },
  { key: "event_type", label: "Event Type", description: "Type of event" },
  { key: "guest_count", label: "Guest Count", description: "Number of guests" },
  { key: "event_spaces", label: "Event Spaces", description: "Spaces already chosen for this booking" },
  { key: "venue_access_hours", label: "Venue Access Hours", description: "Event setup / start / end / teardown when on file" },
  { key: "ceremony_summary", label: "Ceremony Summary", description: "Ceremony location and time from Final Details or space assignments" },
  { key: "reception_summary", label: "Reception Summary", description: "Reception location and time from Final Details or space assignments" },
  { key: "coordinator_name", label: "Coordinator", description: "Venue coordinator / owner name" },
  { key: "package_section", label: "Package", description: "Selected package summary" },
  { key: "included_items_summary", label: "Included Items", description: "Package-defined included services/items" },
  { key: "additional_items_summary", label: "Additional Items", description: "Additional / optional items already on the order" },
  { key: "payment_schedule_summary", label: "Payment Schedule", description: "Payment plan lines on file" },
  { key: "contract_total", label: "Contract Total", description: "Total contracted amount" },
  { key: "balance_remaining", label: "Balance Remaining", description: "Remaining balance on the payment plan when on file" },
  { key: "today_date", label: "Today's Date", description: "Date the agreement is generated" },
  { key: "contract_title", label: "Contract Title", description: "Title of this agreement" },
];

/**
 * Deferred — not in the standard picker (no contract-time SoT).
 * Materialization still substitutes honest fallback wording so legacy
 * Library / draft bodies that still contain these tokens never expose raw
 * {{…}} to Preview or Send. Do not invent underlying domain data.
 */
export const DEFERRED_MERGE_FIELD_KEYS = [
  "vendors_on_file",
] as const;

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
