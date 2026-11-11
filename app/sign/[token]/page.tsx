import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SignForm } from "@/app/sign/[token]/sign-form";
import { ContractSigningArtifact } from "@/components/contracts/contract-signing-artifact";
import { resolveContractBrandPresentation } from "@/lib/contracts/branding";
import { getContractByToken } from "@/lib/contracts/service";

type Props = { params: Promise<{ token: string }> };

// Venue Brand Experience Phase 1: `absolute` stops the root layout's
// "%s · Hello to Cheers" template from appending to this customer-facing tab title.
export const metadata: Metadata = { title: { absolute: "Sign Agreement" } };

/**
 * Public contract signing page — accessible without authentication.
 * The sign_token UUID is the secret authorization mechanism.
 * The contract is displayed in full; the SignForm captures the signer's name
 * and calls sign_contract() via a SECURITY DEFINER RPC.
 */
export default async function SignPage({ params }: Props) {
  const { token } = await params;
  const contract = await getContractByToken(token);

  if (!contract) notFound();

  if (contract.status === "signed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-2xl space-y-3 text-center">
          <p className="text-2xl">✓</p>
          <h1 className="text-xl font-semibold text-gray-800">This agreement is fully executed.</h1>
          {contract.signerName ? (
            <p className="text-sm text-gray-500">Both parties have signed.</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (contract.status !== "sent") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-2xl space-y-3 text-center">
          <h1 className="text-xl font-semibold text-gray-800">This agreement is not available for signing.</h1>
          <p className="text-sm text-gray-500">The link may be expired or the contract may have been cancelled.</p>
        </div>
      </div>
    );
  }

  // Client already signed this token — status stays "sent" until venue countersigns.
  if (contract.tokenSigner?.signedAt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-2xl space-y-3 text-center">
          <p className="text-2xl">✓</p>
          <h1 className="text-xl font-semibold text-gray-800">Your signature is recorded.</h1>
          <p className="text-sm text-gray-500">
            The venue has been notified and will review and countersign. This agreement is not fully executed until the venue signs.
          </p>
        </div>
      </div>
    );
  }

  const venue = contract.venue;
  const brand = resolveContractBrandPresentation(contract.brandingSnapshot, venue);

  return (
    <ContractSigningArtifact
      title={contract.title}
      content={contract.content}
      brand={brand}
      signatureSlot={<SignForm token={token} />}
    />
  );
}
