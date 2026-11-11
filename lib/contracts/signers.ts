import { createHash } from "node:crypto";

/** Shared consent language shown at every signature capture. */
export const CONTRACT_SIGNATURE_CONSENT_TEXT =
  "I agree this constitutes my legal signature on this agreement.";

export function hashContractContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export type ContractSignerType = "venue" | "client";

export type ContractSigner = {
  id: string;
  contractId: string;
  venueId: string;
  signerType: ContractSignerType;
  signerRole: string | null;
  signerRefId: string | null;
  clientContactId: string | null;
  signerName: string | null;
  signerEmail: string | null;
  isRequired: boolean;
  signOrder: number;
  signToken: string;
  signedAt: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  consentConfirmed: boolean | null;
  consentText: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Human-facing progressive labels (locked client-first product language).
 * Underlying status enum stays draft | sent | signed | cancelled | expired.
 *
 * Journey: Draft → Sent to Client → Awaiting Venue Signature → Fully Executed
 */
export type ContractSigningUiState =
  | "draft"
  | "sent_to_client"
  | "awaiting_venue_signature"
  | "fully_signed"
  | "cancelled"
  | "expired";

export function deriveContractSigningUiState(opts: {
  status: string;
  venueSigned: boolean;
  requiredClientTotal: number;
  requiredClientSigned: number;
  expiresAt: string | null;
}): { state: ContractSigningUiState; label: string } {
  const { status, venueSigned, requiredClientTotal, requiredClientSigned, expiresAt } = opts;
  if (status === "cancelled") return { state: "cancelled", label: "Cancelled" };
  if (status === "expired" || (expiresAt && expiresAt < new Date().toISOString().slice(0, 10) && status !== "signed")) {
    return { state: "expired", label: "Expired" };
  }
  if (status === "signed") return { state: "fully_signed", label: "Fully Executed" };

  if (status === "sent") {
    const total = Math.max(1, requiredClientTotal);
    const clientsDone = requiredClientSigned >= total;
    if (clientsDone && !venueSigned) {
      return { state: "awaiting_venue_signature", label: "Awaiting Venue Signature" };
    }
    if (total > 1 && requiredClientSigned > 0 && !clientsDone) {
      return {
        state: "sent_to_client",
        label: `Sent to Client (${requiredClientSigned} of ${total})`,
      };
    }
    return { state: "sent_to_client", label: "Sent to Client" };
  }

  return { state: "draft", label: "Draft" };
}

/** True when any required (or any) client signer has completed a signature. */
export function anyClientHasSigned(signers: Pick<ContractSigner, "signerType" | "signedAt" | "isRequired">[]): boolean {
  return signers.some((s) => s.signerType === "client" && s.signedAt != null);
}

/** True when every required client signer has signed (venue may still be pending). */
export function allRequiredClientsHaveSigned(
  signers: Pick<ContractSigner, "signerType" | "signedAt" | "isRequired">[],
): boolean {
  const required = signers.filter((s) => s.signerType === "client" && s.isRequired);
  if (required.length === 0) {
    // No explicit required clients — treat any client signer set as the bar.
    const clients = signers.filter((s) => s.signerType === "client");
    return clients.length > 0 && clients.every((s) => s.signedAt != null);
  }
  return required.every((s) => s.signedAt != null);
}
