/** Product workspace base URL (separate Next app). */
export const PRODUCT_APP_URL =
  process.env.NEXT_PUBLIC_PRODUCT_APP_URL ?? "http://localhost:3000";

/**
 * Marketing pages as editorial chapters — short chapter name + title.
 */
export const CHAPTERS = {
  why: {
    href: "/our-story",
    chapter: "Our Story",
    title: "Hospitality First",
  },
  product: {
    href: "/product",
    chapter: "Product",
    title: "Follow One Celebration",
  },
  features: {
    href: "/features",
    chapter: "Features",
    title: "Everything Included",
  },
  pricing: {
    href: "/pricing",
    chapter: "Pricing",
    title: null,
  },
  trust: {
    href: "/trust",
    chapter: "Trust",
    title: "Our Promise",
  },
  resources: {
    href: "/resources",
    chapter: "Resources",
    title: "Library",
  },
} as const;

export type ChapterKey = keyof typeof CHAPTERS;

/** Nav shows the short chapter name. */
export const MARKETING_NAV = [
  { href: "/", label: "Home" },
  { href: CHAPTERS.why.href, label: CHAPTERS.why.chapter },
  { href: CHAPTERS.product.href, label: CHAPTERS.product.chapter },
  { href: CHAPTERS.features.href, label: CHAPTERS.features.chapter },
  { href: CHAPTERS.pricing.href, label: CHAPTERS.pricing.chapter },
  { href: "/contact", label: "Contact" },
] as const;

function chapterFooterLabel(key: ChapterKey): string {
  const c = CHAPTERS[key];
  return c.title ? `${c.chapter} · ${c.title}` : c.chapter;
}

/** Explore column in the site footer */
export const FOOTER_EXPLORE = [
  { href: CHAPTERS.why.href, label: chapterFooterLabel("why") },
  { href: CHAPTERS.product.href, label: chapterFooterLabel("product") },
  { href: CHAPTERS.features.href, label: chapterFooterLabel("features") },
  { href: CHAPTERS.pricing.href, label: chapterFooterLabel("pricing") },
  { href: CHAPTERS.resources.href, label: chapterFooterLabel("resources") },
  { href: "/contact", label: "Contact" },
] as const;

/** Trust & legal column in the site footer */
export const FOOTER_TRUST = [
  { href: CHAPTERS.trust.href, label: chapterFooterLabel("trust") },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookies", label: "Cookie Preferences" },
  { href: "/status", label: "System Status" },
] as const;

export const PRIMARY_CTA = {
  href: "/walkthrough",
  label: "Schedule a Walkthrough",
} as const;

/**
 * Sibling near walkthrough CTAs — under-calendar form on /walkthrough
 * (same LeadForm + ingestWalkthroughRequest path; no Calendly time required).
 */
export const MORE_INFO_CTA = {
  href: "/walkthrough?intent=more-info#request-info",
  label: "Request more information",
} as const;

export const LOGIN_LINKS = [
  { href: `${PRODUCT_APP_URL}/login`, label: "Venue", external: true },
  { href: `${PRODUCT_APP_URL}/client/login`, label: "Client", external: true },
  { href: `${PRODUCT_APP_URL}/login`, label: "Vendor", external: true },
] as const;
