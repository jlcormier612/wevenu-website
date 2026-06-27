import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SignForm } from "@/app/sign/[token]/sign-form";
import { getContractByToken } from "@/lib/contracts/service";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: "Sign Agreement" };

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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-3">
          <p className="text-2xl">✓</p>
          <h1 className="text-xl font-semibold text-gray-800">This agreement has already been signed.</h1>
          {contract.signerName && (
            <p className="text-sm text-gray-500">Signed by {contract.signerName}.</p>
          )}
        </div>
      </div>
    );
  }

  if (contract.status !== "sent") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-3">
          <h1 className="text-xl font-semibold text-gray-800">This agreement is not available for signing.</h1>
          <p className="text-sm text-gray-500">The link may be expired or the contract may have been cancelled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Agreement for Review &amp; Signature
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{contract.title}</h1>
        </div>

        {/* Contract content */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 px-8 py-8">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
            {contract.content}
          </pre>
        </div>

        {/* Signature form */}
        <SignForm token={token} />

        <p className="text-center text-xs text-gray-400">
          This document was prepared using Wevenu.
        </p>
      </div>
    </div>
  );
}
