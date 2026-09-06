/**
 * CommercialSelection — engineering name for the venue-facing "Selected Package".
 * Frozen snapshot of what this couple was sold. Never live-bound to Library packages.
 */

export type CommercialSelectionStatus = "draft" | "offered" | "accepted" | "superseded";

export type CommercialSelectionItem = {
  description: string;
  quantity: number;
  unit: string | null;
};

export type CommercialSelection = {
  id: string;
  venueId: string;
  leadId: string | null;
  clientId: string | null;
  eventId: string | null;
  sourcePackageId: string | null;
  name: string;
  totalAmount: number;
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
  totalAmount: number;
  depositAmount: number;
  includedItems: CommercialSelectionItem[];
};

export type CommercialSelectionErrors = Record<string, string>;

export type CommercialSelectionActionResult =
  | { ok: true }
  | { ok: false; errors?: CommercialSelectionErrors; message?: string };

export type CreateCommercialSelectionResult =
  | { ok: true; selectionId: string }
  | { ok: false; errors?: CommercialSelectionErrors; message?: string };
