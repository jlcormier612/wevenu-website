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
  // Embedded from join
  clientName: string | null;
  eventDate: string | null;
};

export type ContractActivity = {
  id: string;
  venueId: string;
  contractId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type ContractWithDetails = Contract & {
  activities: ContractActivity[];
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
};

export type ContractErrors = Record<string, string>;

export type ContractActionResult =
  | { ok: true }
  | { ok: false; errors?: ContractErrors; message?: string };

export type CreateContractResult =
  | { ok: true; contractId: string }
  | { ok: false; errors?: ContractErrors; message?: string };

export type CreateTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; errors?: ContractErrors; message?: string };
