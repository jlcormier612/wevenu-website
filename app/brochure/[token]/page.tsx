import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { getBrochureRenderDataByToken } from "@/lib/brochures/service";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: { absolute: "Brochure" } };

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "Pricing available from the venue";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Public Brochure view — accessible without authentication, same pattern
 * as /sign/[token]: the token is the whole authorization mechanism,
 * resolved entirely server-side inside a SECURITY DEFINER RPC. No signing,
 * no negotiation — this is read-only, brandable marketing material.
 */
export default async function BrochurePage({ params }: Props) {
  const { token } = await params;
  const data = await getBrochureRenderDataByToken(token);
  if (!data) notFound();

  const { brochure, venue, packages, faqs } = data;
  const brandColor = venue.primaryColor || "#5D6F5D";
  const venueDisplayName = venue.name || venue.businessName || "Your Venue";
  const welcomeText = brochure.welcomeText || venue.story || "";
  const brandStyle: CSSProperties = { ["--brand" as string]: brandColor };

  return (
    <div className="min-h-screen bg-white" style={brandStyle}>
      <div className="mx-auto max-w-2xl px-6 py-10 sm:px-10 sm:py-16">
        <header className="flex items-start justify-between gap-4 border-b pb-6" style={{ borderColor: brandColor }}>
          <div>
            {venue.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venue.logoUrl} alt={venueDisplayName} className="mb-2 h-11 w-auto object-contain" />
            )}
            <p className="text-lg font-semibold" style={{ color: "#2A2622" }}>{venueDisplayName}</p>
          </div>
          <a
            href={`/api/brochures/public/${token}/pdf`}
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30"
            style={{ borderColor: "#D8D2C4" }}
          >
            Download PDF
          </a>
        </header>

        <h1 className="mt-8 text-2xl font-semibold" style={{ color: "#2A2622" }}>{brochure.name}</h1>

        {venue.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.heroImageUrl} alt="" className="mt-6 h-56 w-full rounded-md object-cover sm:h-72" />
        )}

        {welcomeText && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Welcome</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "#2A2622" }}>{welcomeText}</p>
          </section>
        )}

        {brochure.includePackages && packages.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Packages</h2>
            <div className="mt-3 space-y-5">
              {packages.map((p, i) => (
                <div key={i}>
                  <p className="font-medium" style={{ color: "#2A2622" }}>{p.name}</p>
                  {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  <p className="mt-1 text-sm font-semibold" style={{ color: brandColor }}>{fmtMoney(p.basePrice)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {brochure.includeFaqs && faqs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frequently Asked Questions</h2>
            <div className="mt-3 space-y-4">
              {faqs.map((f, i) => (
                <div key={i}>
                  <p className="font-medium" style={{ color: "#2A2622" }}>{f.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {brochure.closingText && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next Steps</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "#2A2622" }}>{brochure.closingText}</p>
          </section>
        )}

        {(venue.email || venue.phone || venue.website) && (
          <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground" style={{ borderColor: "#E5E0D4" }}>
            {[venue.email, venue.phone, venue.website].filter(Boolean).join("  ·  ")}
          </footer>
        )}
      </div>
    </div>
  );
}
