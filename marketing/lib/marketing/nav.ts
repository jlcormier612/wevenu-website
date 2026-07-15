/** Product workspace base URL (separate Next app). */
export const PRODUCT_APP_URL =
  process.env.NEXT_PUBLIC_PRODUCT_APP_URL ?? "http://localhost:3000";

export const MARKETING_NAV = [
  { href: "/", label: "Home" },
  { href: "/product", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const PRIMARY_CTA = {
  href: "/walkthrough",
  label: "Request a Walkthrough",
} as const;

export const LOGIN_LINKS = [
  { href: `${PRODUCT_APP_URL}/login`, label: "Venue", external: true },
  { href: `${PRODUCT_APP_URL}/client/login`, label: "Client", external: true },
  { href: `${PRODUCT_APP_URL}/login`, label: "Vendor", external: true },
] as const;
