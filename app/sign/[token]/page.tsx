import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { SignForm } from "@/app/sign/[token]/sign-form";
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

  const venue = contract.venue;

  return (
    <div
      className="min-h-screen bg-gray-50 py-10 px-4"
      style={{
        // Venue Brand Experience Phase 1 — this page previously didn't even
        // know the venue's own name, let alone its brand.
        "--venue-primary": venue?.primaryColor ?? "#5D6F5D",
        "--venue-secondary": venue?.secondaryColor ?? "#4F5F4F",
        "--venue-accent": venue?.accentColor ?? "#B8AEA1",
        "--venue-neutral": venue?.neutralColor ?? "#F7F5F1",
      } as CSSProperties}
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="rounded-xl bg-white shadow-sm border-t-4 border border-gray-200 px-8 py-6" style={{ borderTopColor: "var(--venue-primary)" }}>
          <div className="flex items-center gap-3 mb-3">
            {venue?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venue.logoUrl} alt={venue.name ?? ""} className="h-9 w-9 rounded-full object-cover shrink-0" />
            )}
            {venue?.name && <p className="text-sm font-semibold text-gray-700">{venue.name}</p>}
          </div>
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
      </div>
    </div>
  );
}
