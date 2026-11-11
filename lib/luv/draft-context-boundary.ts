/**
 * Customer-facing Luv draft context — provenance boundary.
 *
 * Authorship lives on leads.inquiry_message_origin (write-path durable).
 * Exclude venue and unknown/legacy text BEFORE the prompt is built.
 */

export type { InquiryMessageOrigin as InquiryOrigin } from "@/lib/leads/inquiry-message-origin";
export {
  customerFacingInquiryMessage,
  normalizeInquiryMessageOrigin,
} from "@/lib/leads/inquiry-message-origin";

export function resolveDraftDeleteDecision(
  existing: { id: string } | null,
  readError: { message?: string } | null,
): { proceed: true } | { proceed: false; message: string } {
  if (readError) {
    return { proceed: false, message: "Couldn't discard that draft. Please try again." };
  }
  if (!existing) {
    return { proceed: false, message: "That draft is no longer available." };
  }
  return { proceed: true };
}
