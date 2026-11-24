import type { Metadata } from "next";

/**
 * Marketing page SEO helpers.
 * Canonicals always use the public apex (hellotocheers.com).
 * Do not invent ratings, reviews, or unsupported claims in structured data.
 */

export const MARKETING_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
  "https://hellotocheers.com"
).replace(/\/$/, "");

export function marketingCanonicalPath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Page metadata with explicit canonical.
 * Prefer title + description only so root OG/Twitter share image is preserved
 * (Next replaces parent openGraph when a child sets openGraph without images).
 */
export function marketingPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  robots?: Metadata["robots"];
}): Metadata {
  const path = marketingCanonicalPath(input.path);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: path },
    ...(input.robots ? { robots: input.robots } : {}),
  };
}

/** Factual Organization + SoftwareApplication JSON-LD (no ratings/reviews). */
export function marketingStructuredDataGraph(): Record<string, unknown> {
  const logoUrl = `${MARKETING_SITE_URL}/brand/hello-to-cheers-logo.png`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${MARKETING_SITE_URL}/#organization`,
        name: "Hello to Cheers",
        url: MARKETING_SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${MARKETING_SITE_URL}/#software`,
        name: "Hello to Cheers",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: MARKETING_SITE_URL,
        description:
          "Wedding and event venue management software for running your venue, planning events, and keeping your team, clients, and vendors connected.",
        publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
        offers: {
          "@type": "Offer",
          url: `${MARKETING_SITE_URL}/pricing`,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${MARKETING_SITE_URL}/#website`,
        url: MARKETING_SITE_URL,
        name: "Hello to Cheers",
        publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
      },
    ],
  };
}
