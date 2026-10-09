/**
 * CommercialSelection — engineering name for the venue-facing "Selected Package".
 * Frozen snapshot of what this couple was sold. Never live-bound to Library packages.
 */

export type CommercialSelectionStatus = "draft" | "offered" | "accepted" | "superseded";

export type CommercialSelectionItem = {
  description: string;
  quantity: number;
  unit: string | null;
  /** Frozen line economics when present (proposal-approved selections). */
  unitPrice?: number;
  lineTotal?: number;
  offerRole?: "primary" | "addon";
  sourcePackageId?: string | null;
};

export type CommercialSelection = {
  id: string;
  venueId: string;
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  /** L1 commercial_proposals id when created from a multi-option proposal; null for direct Select package. */
  proposalId: string | null;
  sourcePackageId: string | null;
  name: string;
  /**
   * Original package price before discount/tax.
   * Legacy rows without a separate package use the same value as totalAmount.
   */
  packageAmount: number;
  /** True discount dollars only (never a deposit). Frozen when applied. */
  discountAmount: number;
  discountType: "fixed" | "percent" | null;
  discountValue: number | null;
  /** Exclusive tax was deliberately applied to these terms. */
  taxApplied: boolean;
  taxRatePercent: number | null;
  taxAmount: number;
  /**
   * Final agreed commercial commitment: package − discount + tax.
   * Invoice and payment plans inherit this amount.
   */
  totalAmount: number;
  /** Payment allocation suggestion — not a discount, not in the taxable base. */
  depositAmount: number;
  includedItems: CommercialSelectionItem[];
  status: CommercialSelectionStatus;
  version: number;
  supersededById: string | null;
  offeredAt: string | null;
  acceptedAt: string | null;
  acceptToken: string | null;
  offerMessage: string | null;
  invoiceId: string | null;
  contractId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCommercialSelectionInput = {
  leadId?: string;
  clientId?: string;
  eventId?: string;
  sourcePackageId: string;
  name: string;
  /** Original package price; defaults to totalAmount when omitted (legacy callers). */
  packageAmount?: number;
  discountAmount?: number;
  discountType?: "fixed" | "percent" | null;
  discountValue?: number | null;
  taxApplied?: boolean;
  taxRatePercent?: number | null;
  taxAmount?: number;
  /** Final agreed total (package − discount + tax). */
  totalAmount: number;
  depositAmount: number;
  includedItems: CommercialSelectionItem[];
};

/** Update financial terms on a draft Selected Package before contract/invoice. */
export type UpdateCommercialSelectionTermsInput = {
  packageAmount: number;
  discountType?: "fixed" | "percent" | null;
  discountValue?: number | null;
  applyTax: boolean;
  taxRatePercent?: number | null;
  depositAmount: number;
};

export type CommercialSelectionErrors = Record<string, string>;

export type CommercialSelectionActionResult =
  | { ok: true }
  | { ok: false; errors?: CommercialSelectionErrors; message?: string };

export type CreateCommercialSelectionResult =
  | { ok: true; selectionId: string }
  | { ok: false; errors?: CommercialSelectionErrors; message?: string };
