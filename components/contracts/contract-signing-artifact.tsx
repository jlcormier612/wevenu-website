import type { CSSProperties } from "react";
import type { ReactNode } from "react";

import type { ContractBrandingSnapshot } from "@/lib/contracts/branding";

/**
 * Customer-facing contract/agreement presentation used by /sign/{token}
 * and venue full-screen review. Preview mode never collects a signature.
 */
export function ContractSigningArtifact({
  title,
  content,
  brand,
  signatureSlot,
}: {
  title: string;
  content: string;
  brand: ContractBrandingSnapshot | null;
  signatureSlot?: ReactNode;
}) {
  const brandStyle = {
    "--venue-primary": brand?.primaryColor ?? "#5D6F5D",
    "--venue-secondary": brand?.secondaryColor ?? "#4F5F4F",
    "--venue-accent": brand?.accentColor ?? "#B8AEA1",
    "--venue-neutral": brand?.neutralColor ?? "#F7F5F1",
  } as CSSProperties;

  return (
    <div className="min-h-full bg-gray-50 py-10 px-4" style={brandStyle}>
      <div className="mx-auto max-w-3xl space-y-8">
        <div
          className="rounded-xl border border-gray-200 border-t-4 bg-white px-6 py-6 shadow-sm sm:px-8"
          style={{ borderTopColor: "var(--venue-primary)" }}
        >
          <div className="mb-3 flex items-center gap-3">
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name ?? ""}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : null}
            {brand?.name ? (
              <p className="text-sm font-semibold text-gray-700">{brand.name}</p>
            ) : null}
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Agreement for Review &amp; Signature
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{title}</h1>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
            {content}
          </pre>
        </div>

        {signatureSlot}
      </div>
    </div>
  );
}
