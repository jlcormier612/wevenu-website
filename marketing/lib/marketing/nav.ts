/** Product workspace base URL (separate Next app). */
export const PRODUCT_APP_URL =
  process.env.NEXT_PUBLIC_PRODUCT_APP_URL ?? "http://localhost:3000";

/**
 * Marketing pages as editorial chapters — short chapter name + title.
 * Chapter names here remain content/metadata labels; visible header/footer
 * chrome uses MARKETING_NAV / FOOTER_* with refined hospitality wording.
 */
export const CHAPTERS = {
  why: {
    href: "/our-story",
    chapter: "Our Story",
    title: null,
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
  /**
   * Retired public marketing Library directory (redirects to /features).
   * Not the in-app venue Library.
   */
  resources: {
    href: "/resources",
    chapter: "Resources",
    title: "Library",
  },
} as const;

export type ChapterKey = keyof typeof CHAPTERS;

/**
 * Primary header navigation — logo links Home; Home is not a text item.
 * Visible labels refined; routes preserved.
 */
export const MARKETING_NAV = [
  { href: CHAPTERS.why.href, label: "Our Story" },
  { href: CHAPTERS.product.href, label: "The Platform" },
  { href: CHAPTERS.features.href, label: "All Features" },
  { href: CHAPTERS.pricing.href, label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

/** Explore column in the site footer */
export const FOOTER_EXPLORE = [
  { href: CHAPTERS.why.href, label: "Our Story" },
  { href: CHAPTERS.product.href, label: "The Platform" },
  { href: CHAPTERS.features.href, label: "All Features" },
  { href: CHAPTERS.pricing.href, label: "Pricing" },
  { href: "/walkthrough", label: "Schedule a Walkthrough" },
  { href: "/contact", label: "Contact" },
] as const;

/** Trust & Support column — public marketing Library retired */
export const FOOTER_TRUST_SUPPORT = [
  { href: CHAPTERS.trust.href, label: "Our Promise" },
  { href: "/status", label: "System Status" },
] as const;

/** Legal column — every existing legal/policy destination retained */
export const FOOTER_LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Venue Subscription Agreement" },
  { href: "/end-user-terms", label: "End User Terms" },
  { href: "/vendor-terms", label: "Vendor Terms" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/acceptable-use", label: "Acceptable Use Policy" },
] as const;

/** @deprecated Prefer FOOTER_TRUST_SUPPORT + FOOTER_LEGAL */
export const FOOTER_TRUST = [
  ...FOOTER_TRUST_SUPPORT,
  ...FOOTER_LEGAL,
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
  { href: `${PRODUCT_APP_URL}/vendor/login`, label: "Vendor", external: true },
] as const;
