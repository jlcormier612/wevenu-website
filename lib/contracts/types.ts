/**
 * Contracts domain types (Sprint 15 — Contracts Foundation).
 */

export type ContractStatus = "draft" | "sent" | "signed" | "cancelled" | "expired";

export type ContractTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  content: string; // plain text with {{merge_field}} tokens
  isDefault: boolean;
  // Archive, not hard-delete, is the default removal path — matching
  // Planning/Timeline/Floor Plan Templates (Template Platform — Release
  // Readiness parity pass).
  isArchived: boolean;
  sourceMasterKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Contract = {
  id: string;
  venueId: string;
  clientId: string | null;
  eventId: string | null;
  templateId: string | null;
  title: string;
  content: string; // rendered (tokens already resolved)
  status: ContractStatus;
  signToken: string;
  signerName: string | null;
  signedAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Work Package D4 — set only on a newly-created amendment; mirrors invoices.amendsInvoiceId exactly. */
  amendsContractId: string | null;
  // Embedded from join
  clientName: string | null;
  clientEmail: string | null;
  eventDate: string | null;
  // Venue Brand Experience Phase 1 — only populated by getContractByToken
  // (the public sign page's own read); every other Contract-producing
  // function leaves this undefined, since they don't join venues.
  venue?: {
    name: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
    neutralColor: string | null;
    logoUrl: string | null;
  } | null;
};

export type ContractActivity = {
  id: string;
  venueId: string;
  contractId: string;
  type: string;
  title: string;
  description: string | null;
  actorId: string | null;
  actorLabel: string | null;
  createdAt: string;
};

export type ContractWithDetails = Contract & {
  activities: ContractActivity[];
  signers: import("@/lib/contracts/signers").ContractSigner[];
};

export type TemplateInput = {
  name: string;
  description: string;
  content: string;
  isDefault: boolean;
};

export type NewContractInput = {
  templateId: string;
  clientId: string;
  eventId: string;
  title: string;
  content: string; // may be pre-filled from template merge
  /** Work Package D4 — set only by createAmendmentFromContract. */
  amendsContractId?: string;
  /**
   * Client contact ids selected as required signers. Empty/undefined → default
   * one required signer from the client's primary contact (or client record).
   * Never auto-assumes couple = two signers.
   */
  clientSignerContactIds?: string[];
};

export type ContractErrors = Record<string, string>;

export type ContractActionResult =
  | { ok: true }
  /** reason:"stale" — Work Package D4's concurrency check — a save was rejected because someone else saved first; the UI should prompt a reload, never silently overwrite. */
  | { ok: false; errors?: ContractErrors; message?: string; reason?: "stale" | "not_editable" | "not_found" };

export type CreateContractResult =
  | { ok: true; contractId: string }
  | { ok: false; errors?: ContractErrors; message?: string };

export type CreateTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; errors?: ContractErrors; message?: string };
