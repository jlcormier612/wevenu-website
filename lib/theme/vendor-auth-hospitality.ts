import type { CSSProperties } from "react";

/**
 * Vendor public auth surfaces (login / claim) sit outside `.htc-staff`, so
 * they cannot inherit Contemporary Botanical tokens via class. Pin the same
 * approved light HEX values here — do not invent a parallel palette.
 *
 * Uses leaf-muted (`#7E9E88`) for ring as the vendor accent (softer partner
 * chrome vs venue botanical authority). Primary CTAs stay botanical.
 *
 * See docs/design/htc-visual-system.md.
 */
export const VENDOR_AUTH_HOSPITALITY_STYLE = {
  background: "#f8f7f3",
  "--background": "#ffffff",
  "--foreground": "#24332b",
  "--heading": "#24332b",
  "--card": "#ffffff",
  "--card-foreground": "#24332b",
  "--popover": "#ffffff",
  "--popover-foreground": "#24332b",
  "--muted": "color-mix(in oklch, #a7c2af 18%, white)",
  "--muted-foreground": "#5f6f68",
  "--secondary": "#ffffff",
  "--secondary-foreground": "#24332b",
  "--primary": "#446b56",
  "--primary-foreground": "#ffffff",
  "--accent": "#a7c2af",
  "--accent-foreground": "#24332b",
  "--border": "#e6e3dc",
  "--input": "#e6e3dc",
  "--ring": "#7e9e88",
  "--destructive": "#d99a9e",
  "--destructive-foreground": "#24332b",
} as CSSProperties;
