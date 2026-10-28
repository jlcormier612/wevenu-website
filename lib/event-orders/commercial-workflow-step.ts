/**
 * P2-B — Which step of the composed Event Order spine is current.
 * Presentation only; does not mutate commercial state.
 *
 * Invoice becomes current once the Event Order is finalized (venue-controlled).
 * Sharing / signature is optional and is not a gate for invoicing.
 */
import {
  isClientChoicesNeedsVenueReview,
  toClientChoicesDisplayStatus,
} from "@/lib/client-choices/constants";

export type CommercialWorkflowStepId = "build" | "awaiting" | "review" | "order" | "invoice";

export function resolveCommercialWorkflowStep(input: {
  choices: Array<{ status: string }>;
  eventOrder: { sharedAt?: string | Date | null; status?: string | null } | null;
  hasEoInvoice: boolean;
  /** When live EO diverges from last share, venue must re-share before original invoice. */
  shareCommitmentStale?: boolean;
  unbilledAmount?: number;
}): CommercialWorkflowStepId {
  const needsReview = input.choices.some((c) => isClientChoicesNeedsVenueReview(c.status));
  if (needsReview) return "review";
  const awaiting = input.choices.some((c) => {
    const d = toClientChoicesDisplayStatus(c.status);
    return d === "awaiting_client" || d === "changes_requested";
  });
  if (awaiting) return "awaiting";
  const draft = input.choices.some((c) => c.status === "draft");
  if (draft || input.choices.length === 0) return "build";
  // Stale share after material EO changes: order row owns re-share before first invoice.
  if (input.shareCommitmentStale && input.eventOrder?.sharedAt && !input.hasEoInvoice) {
    return "order";
  }
  if (input.hasEoInvoice) return "invoice";
  // Finalized EO is the invoice gate — share/signature is not required.
  if (input.eventOrder?.status === "finalized" || input.eventOrder?.sharedAt) {
    return "invoice";
  }
  return "order";
}
