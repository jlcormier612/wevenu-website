import type { MetadataRoute } from "next";

/**
 * Public marketing sitemap only.
 * Excludes API routes, tokenized offer links, preview labs, concepts,
 * checkout success, and app/workspace/portal hosts (separate origins).
 */
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
  "https://hellotocheers.com"
).replace(/\/$/, "");

const PUBLIC_PATHS = [
  "/",
  "/our-story",
  "/product",
  "/features",
  "/getting-started",
  "/pricing",
  "/trust",
  "/walkthrough",
  "/contact",
  "/welcome-back",
  "/our-first-friends",
  "/support",
  "/about",
  "/sms-opt-in",
  "/privacy",
  "/terms",
  "/end-user-terms",
  "/vendor-terms",
  "/cookie-policy",
  "/cookies",
  "/acceptable-use",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? SITE : `${SITE}${path}`,
    lastModified,
    changeFrequency: path === "/" || path === "/pricing" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/pricing" || path === "/product" ? 0.9 : 0.7,
  }));
}
