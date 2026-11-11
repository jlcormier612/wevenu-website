/**
 * Shared color derivation for CSS print documents (Invoice, Day Sheet).
 * Companion to lib/collateral/pdf-brand.ts — same null-safety shape, CSS-ready.
 *
 * Raw brand roles are preserved for fills/borders. Financial / body ink on
 * Neutral and white must pass WCAG AA via readableInk — never paint cream
 * Accent amounts on a pale Neutral banner.
 */

import { resolvePdfBrandColors, type CollateralBrandColors } from "@/lib/collateral/pdf-brand";
import { inkOn, mutedInkOn, readableInk } from "@/lib/theme/public-form-surface";

export type { CollateralBrandColors };

export type PrintBrandInk = CollateralBrandColors & {
  /** Readable ink on Primary-filled headers. */
  onPrimary: string;
  /** Prefer Accent when it clears 4.5:1 on Neutral; else black/white. */
  accentOnNeutral: string;
  /** Prefer Accent when it clears 4.5:1 on white page body. */
  accentOnWhite: string;
  /** Prefer Secondary when it clears 4.5:1 on white (section heads). */
  secondaryOnWhite: string;
  /** Muted label ink that still clears 4.5:1 on Neutral. */
  mutedOnNeutral: string;
};

export function resolvePrintBrandColors(venue: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  neutralColor?: string | null;
}): CollateralBrandColors {
  return resolvePdfBrandColors(venue);
}

/** Print document brand fills plus contrast-safe financial/body ink. */
export function resolvePrintBrandInk(venue: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  neutralColor?: string | null;
}): PrintBrandInk {
  const brand = resolvePdfBrandColors(venue);
  return {
    ...brand,
    onPrimary: inkOn(brand.primary),
    accentOnNeutral: readableInk(brand.accent, brand.neutral),
    accentOnWhite: readableInk(brand.accent, "#FFFFFF"),
    secondaryOnWhite: readableInk(brand.secondary, "#FFFFFF"),
    mutedOnNeutral: mutedInkOn(brand.neutral),
  };
}
