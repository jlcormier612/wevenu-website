import { BrochurePhotoComposition } from "@/components/brochures/brochure-photo-composition";
import { formatPrice } from "@/lib/packages/constants";
import type { BrochureRenderData } from "@/lib/brochures/types";
import type { CSSProperties } from "react";

/**
 * Customer-facing brochure presentation. Library preview and the public
 * /brochure/{token} page share this renderer. No internal authoring captions.
 *
 * Venue Brand Colors roles (intentional, not maximum usage):
 * - Primary: primary brand rule under the header / contact divider
 * - Secondary: supporting section headings (aligned with PDF brochure)
 * - Accent: selective emphasis on package prices and availability CTA
 * - Neutral: soft venue-branded article surface (not HTC app background)
 */
export function BrochurePreviewView({
  data,
}: {
  data: BrochureRenderData;
}) {
  const { brochure, venue, packages, faqs } = data;
  const venueDisplayName = venue.name || venue.businessName || "Your Venue";
  const welcomeText = brochure.welcomeText || venue.story || "";
  const contactLine = [venue.email, venue.phone, venue.website].filter(Boolean).join(" · ");
  const photoUrls = brochure.photoUrls;
  const brandStyle = {
    "--venue-primary": venue.primaryColor || "#5D6F5D",
    "--venue-secondary": venue.secondaryColor || "#4F5F4F",
    "--venue-accent": venue.accentColor || "#B8AEA1",
    "--venue-neutral": venue.neutralColor || "#F7F5F1",
    backgroundColor: "var(--venue-neutral)",
  } as CSSProperties;

  const sectionHeadStyle = {
    color: "var(--venue-secondary)",
    borderBottom: "1px solid var(--venue-secondary)",
    paddingBottom: "0.25rem",
  } as CSSProperties;

  return (
    <article
      className="space-y-8 overflow-x-hidden rounded-lg border border-border p-6 sm:p-10"
      style={brandStyle}
      data-venue-brand="brochure"
    >
      <header
        className="flex flex-wrap items-start justify-between gap-4 border-b pb-6"
        style={{ borderBottomColor: "var(--venue-primary)" }}
      >
        <div className="space-y-2">
          {venue.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={venue.logoUrl} alt="" className="h-12 w-auto object-contain" />
          ) : null}
          <p
            className="font-heading text-lg font-medium"
            style={{ color: "var(--venue-secondary)" }}
          >
            {venueDisplayName}
          </p>
        </div>
        <h1
          className="font-heading text-xl font-medium sm:text-right"
          style={{ color: "var(--venue-secondary)" }}
        >
          {brochure.name}
        </h1>
      </header>

      <BrochurePhotoComposition urls={photoUrls} layout={brochure.photoLayout} />

      {welcomeText ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={sectionHeadStyle}>
            Welcome
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{welcomeText}</p>
        </section>
      ) : null}

      {brochure.includePackages ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={sectionHeadStyle}>
            Packages
          </h2>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active packages yet.</p>
          ) : (
            <ul className="space-y-4">
              {packages.map((pkg) => (
                <li key={pkg.name} className="space-y-1">
                  <p className="font-medium text-foreground">{pkg.name}</p>
                  {pkg.description ? (
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  ) : null}
                  <p className="text-sm font-medium" style={{ color: "var(--venue-accent)" }}>
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
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={sectionHeadStyle}>
            FAQs
          </h2>
          {faqs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published client FAQs yet.</p>
          ) : (
            <ul className="space-y-4">
              {faqs.map((faq) => (
                <li key={faq.question} className="space-y-1">
                  <p className="font-medium text-foreground">{faq.question}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{faq.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {brochure.closingText ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={sectionHeadStyle}>
            Next steps
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{brochure.closingText}</p>
        </section>
      ) : null}

      {data.availabilityPath ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={sectionHeadStyle}>
            Available dates
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            Check which dates are currently available. This link always shows current availability.
          </p>
          <a
            href={data.availabilityPath}
            className="text-sm font-medium underline"
            style={{ color: "var(--venue-accent)" }}
          >
            See available dates
          </a>
        </section>
      ) : null}

      {contactLine ? (
        <p
          className="border-t pt-4 text-sm text-muted-foreground"
          style={{ borderTopColor: "var(--venue-primary)" }}
        >
          {contactLine}
        </p>
      ) : null}
    </article>
  );
}
