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
 * Customer-facing Contract Builder Smart Fields.
 *
 * Only intentionally supported, authoritative, useful fields belong here.
 * Resolvers may still materialize legacy tokens for older drafts — those keys
 * must NOT reappear in this picker catalog.
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
  { key: "ceremony_space", label: "Ceremony Space", description: "Ceremony space already listed on this booking" },
  { key: "reception_space", label: "Reception Space", description: "Reception space already listed on this booking" },
  { key: "package_section", label: "Package", description: "Selected package summary from the booking" },
  { key: "included_items_summary", label: "Included Items", description: "Included items on the selected package or order" },
  { key: "additional_items_summary", label: "Additional Items", description: "Additional / optional items already on the order" },
  { key: "payment_schedule_summary", label: "Payment Schedule", description: "Payment plan lines on file when a schedule exists" },
  { key: "contract_total", label: "Contract Total", description: "Total contracted / selected package amount" },
  { key: "balance_remaining", label: "Balance Remaining", description: "Remaining balance from the payment plan, or selected amount minus deposit" },
  { key: "today_date", label: "Today's Date", description: "Date the agreement is generated" },
  { key: "contract_title", label: "Contract Title", description: "Title of this agreement" },
];

/**
 * Removed from the customer-facing catalog because the promised data is not
 * reliably present at contract time. Resolvers still materialize these for
 * older drafts so Preview/Send never emit raw tokens.
 */
export const REMOVED_MERGE_FIELD_KEYS = [
  "venue_access_hours",
  "ceremony_summary",
  "reception_summary",
  "coordinator_name",
] as const;

/** Deferred — not in the standard picker (no contract-time SoT). */
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
