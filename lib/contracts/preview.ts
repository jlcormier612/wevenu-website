/**
 * Sample merge for contract template preview only.
 * Uses two distinct people in the signature section so a couple is never
 * shown as one combined signature line.
 */
import { applyRequiredSignerSignatureBlocks } from "@/lib/contracts/signature-blocks";
import { mergeContent, type MergeData } from "@/lib/shared-merge/tokens";

export const CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS = [
  "Buppy Robicheaux",
  "Joy Robicheaux",
] as const;

export const CONTRACT_PREVIEW_SAMPLE_VENUE = "Jen's Fancy Venue";

export function contractTemplatePreviewMergeData(): MergeData {
  return {
    venue_name: CONTRACT_PREVIEW_SAMPLE_VENUE,
    venue_address: "123 Garden Lane",
    venue_phone: "(555) 010-2000",
    venue_email: "hello@example.com",
    client_name: `${CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS[0]} & ${CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS[1]}`,
    couple_name: `${CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS[0]} & ${CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS[1]}`,
    primary_contact_name: CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS[0],
    first_name: "Buppy",
    last_name: "Robicheaux",
    full_name: CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS[0],
    client_email: "buppy@example.com",
    client_phone: "(555) 010-1000",
    event_name: "Buppy & Joy",
    event_date: "October 10, 2026",
    event_type: "Wedding",
    guest_count: "120",
    event_spaces: "Garden & Barn",
    coordinator_name: "Jordan",
    venue_access_hours: "Start 2:00 PM · End 11:00 PM",
    ceremony_summary: "Garden ceremony",
    reception_summary: "Barn reception",
    package_section: "Classic Wedding Package",
    included_items_summary: "Tables and chairs as listed on the booking",
    additional_items_summary: "No additional items listed",
    payment_schedule_summary: "As listed on the booking",
    contract_total: "As listed on the booking",
    balance_remaining: "As listed on the booking",
    vendors_on_file: "No vendors listed yet",
    today_date: "August 19, 2026",
    contract_title: "Wedding Venue Agreement",
  };
}

/** Preview a template with sample values and individual signature blocks. */
export function previewContractTemplateContent(templateContent: string): string {
  const merged = mergeContent(templateContent, contractTemplatePreviewMergeData());
  return applyRequiredSignerSignatureBlocks(merged, [...CONTRACT_PREVIEW_SAMPLE_CLIENT_SIGNERS]);
}
