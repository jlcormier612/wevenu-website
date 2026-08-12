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

/** Derived UI labels — never engineering jargon. */
export type ContractSigningUiState =
  | "review"
  | "sign_contract"
  | "signed_by_venue"
  | "ready_for_client"
  | "awaiting_client_signature"
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
  if (status === "signed") return { state: "fully_signed", label: "Fully signed" };
  if (status === "sent") {
    if (requiredClientTotal > 1) {
      return {
        state: "awaiting_client_signature",
        label: `Awaiting client signature (${requiredClientSigned} of ${requiredClientTotal})`,
      };
    }
    return { state: "awaiting_client_signature", label: "Awaiting client signature" };
  }
  if (venueSigned) return { state: "ready_for_client", label: "Ready for client" };
  return { state: "sign_contract", label: "Sign contract" };
}
