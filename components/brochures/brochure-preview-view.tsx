import { formatPrice } from "@/lib/packages/constants";
import type { BrochureRenderData } from "@/lib/brochures/types";

/**
 * On-screen brochure presentation for full-page Library Preview.
 * Packages and FAQs are live-bound from current venue data (intentional).
 */
export function BrochurePreviewView({ data }: { data: BrochureRenderData }) {
  const { brochure, venue, packages, faqs } = data;
  const venueDisplayName = venue.name || venue.businessName || "Your Venue";
  const welcomeText = brochure.welcomeText || venue.story || "";
  const contactLine = [venue.email, venue.phone, venue.website].filter(Boolean).join(" · ");

  return (
    <article className="space-y-8 rounded-lg border border-border bg-background p-6 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          {venue.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={venue.logoUrl} alt="" className="h-12 w-12 object-contain" />
          ) : null}
          <p className="font-heading text-lg font-medium text-heading">{venueDisplayName}</p>
        </div>
        <h1 className="font-heading text-xl font-medium text-heading text-right">{brochure.name}</h1>
      </header>

      {venue.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={venue.heroImageUrl}
          alt=""
          className="h-48 w-full rounded-md object-cover sm:h-64"
        />
      ) : null}

      {welcomeText ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Welcome</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{welcomeText}</p>
        </section>
      ) : null}

      {brochure.includePackages ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Packages</h2>
          <p className="text-xs text-muted-foreground">
            Pulled live from your current Packages — updates here when you change Packages.
          </p>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active packages yet.</p>
          ) : (
            <ul className="space-y-4">
              {packages.map((pkg) => (
                <li key={pkg.name} className="space-y-1">
                  <p className="font-medium text-heading">{pkg.name}</p>
                  {pkg.description ? (
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  ) : null}
                  <p className="text-sm font-medium text-foreground">
                    {pkg.basePrice != null ? formatPrice(pkg.basePrice) : "Pricing available from the venue"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {brochure.includeFaqs ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FAQs</h2>
          <p className="text-xs text-muted-foreground">
            Pulled live from your Venue Guide FAQs — updates here when those change.
          </p>
          {faqs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published client FAQs yet.</p>
          ) : (
            <ul className="space-y-4">
              {faqs.map((faq) => (
                <li key={faq.question} className="space-y-1">
                  <p className="font-medium text-heading">{faq.question}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{faq.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {brochure.closingText ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next steps</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{brochure.closingText}</p>
        </section>
      ) : null}

      {contactLine ? (
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">{contactLine}</p>
      ) : null}
    </article>
  );
}
