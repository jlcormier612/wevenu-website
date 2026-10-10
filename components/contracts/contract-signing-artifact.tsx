import type { ReactNode } from "react";

import type { ContractBrandingSnapshot } from "@/lib/contracts/branding";
import { venueBrandSurfaceStyle } from "@/lib/theme/venue-brand-surface";

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
  const brandStyle = venueBrandSurfaceStyle({
    primaryColor: brand?.primaryColor,
    secondaryColor: brand?.secondaryColor,
    accentColor: brand?.accentColor,
    neutralColor: brand?.neutralColor,
  });

  return (
    <div className="min-h-full py-10 px-4 text-foreground" style={brandStyle} data-theme-lock="light" data-venue-brand="contract">
      <div className="mx-auto max-w-3xl space-y-8">
        <div
          className="rounded-xl border border-border border-t-4 px-6 py-6 shadow-sm sm:px-8"
          style={{ borderTopColor: "var(--venue-primary)", backgroundColor: "var(--venue-card)" }}
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
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{title}</h1>
          <div
            className="mt-3 h-0.5 w-12 rounded-full"
            style={{ backgroundColor: "var(--venue-accent)" }}
            aria-hidden
          />
        </div>

        <div className="rounded-xl border border-border px-6 py-8 shadow-sm sm:px-8" style={{ backgroundColor: "var(--venue-card)" }}>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {content}
          </pre>
        </div>

        {signatureSlot}
      </div>
    </div>
  );
}
