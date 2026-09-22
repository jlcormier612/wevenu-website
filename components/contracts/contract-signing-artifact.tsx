import type { CSSProperties } from "react";
import type { ReactNode } from "react";

import type { ContractBrandingSnapshot } from "@/lib/contracts/branding";

/**
 * Customer-facing contract/agreement presentation used by /sign/{token}
 * and venue full-screen review. Preview mode never collects a signature.
 *
 * Venue Brand Colors roles (styling only — does not change signing lifecycle):
 * - Primary: primary brand rule on the title card
 * - Secondary: supporting eyebrow / venue name treatment
 * - Accent: selective emphasis rule under the title
 * - Neutral: soft venue-branded page surface (not HTC gray-50)
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
    backgroundColor: "var(--venue-neutral)",
  } as CSSProperties;

  return (
    <div className="min-h-full py-10 px-4" style={brandStyle} data-venue-brand="contract">
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
              <p className="text-sm font-semibold" style={{ color: "var(--venue-secondary)" }}>
                {brand.name}
              </p>
            ) : null}
          </div>
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--venue-secondary)" }}
          >
            Agreement for Review &amp; Signature
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{title}</h1>
          <div
            className="mt-3 h-0.5 w-12 rounded-full"
            style={{ backgroundColor: "var(--venue-accent)" }}
            aria-hidden
          />
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
