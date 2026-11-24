import type { MetadataRoute } from "next";

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
  "https://hellotocheers.com"
).replace(/\/$/, "");

/**
 * Marketing-host robots only.
 * Disallow preview labs, concepts, tokenized offers, and API.
 * App / workspace / portal hosts are separate origins and are not listed here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/custom-offer/",
        "/features/showroom-preview",
        "/concepts/",
        "/pricing/success",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE.replace(/^https?:\/\//, ""),
  };
}
