/**
 * Shared color derivation for CSS print documents (Invoice, Day Sheet).
 * Companion to lib/collateral/pdf-brand.ts — same null-safety shape, CSS-ready.
 */

import { resolvePdfBrandColors, type CollateralBrandColors } from "@/lib/collateral/pdf-brand";

export type { CollateralBrandColors };

export function resolvePrintBrandColors(venue: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  neutralColor?: string | null;
}): CollateralBrandColors {
  return resolvePdfBrandColors(venue);
}
