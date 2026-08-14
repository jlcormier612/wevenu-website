/**
 * Shared color derivation for @react-pdf/renderer collateral.
 * Two small helpers (pdf vs print CSS) rather than one awkward shared component —
 * see docs/venue-white-label-collateral-implementation-plan.md Workstream B.
 */

export type CollateralBrandColors = {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
};

const DEFAULTS = {
  primary: "#5D6F5D",
  secondary: "#4F5F4F",
  accent: "#B8AEA1",
  neutral: "#F7F5F1",
} as const;

export function resolvePdfBrandColors(venue: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  neutralColor?: string | null;
}): CollateralBrandColors {
  return {
    primary: venue.primaryColor || DEFAULTS.primary,
    secondary: venue.secondaryColor || DEFAULTS.secondary,
    accent: venue.accentColor || DEFAULTS.accent,
    neutral: venue.neutralColor || DEFAULTS.neutral,
  };
}
