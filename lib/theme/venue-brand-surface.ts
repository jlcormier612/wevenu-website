import type { CSSProperties } from "react";

import {
  PUBLIC_FORM_LIGHT_VARS,
  inkOn,
  mutedInkOn,
  readableInk,
  relativeLuminance,
} from "@/lib/theme/public-form-surface";

/**
 * Shared customer-facing venue brand surface.
 *
 * Venue brand colors influence accents and decoration. They must never become
 * unreadable body, price, or control ink. WCAG 2.2 AA (4.5:1 normal text) is
 * the floor for text on the resolved surface.
 */

export const DEFAULT_VENUE_BRAND = {
  primaryColor: "#5D6F5D",
  secondaryColor: "#4F5F4F",
  accentColor: "#B8AEA1",
  neutralColor: "#F7F5F1",
} as const;

export type VenueBrandColors = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  neutralColor?: string | null;
};

export type ResolvedVenueBrandSurface = {
  primary: string;
  secondaryRaw: string;
  accentRaw: string;
  surface: string;
  /** Readable ink for headings / venue name (prefers secondary). */
  text: string;
  /** Readable muted body copy on the surface. */
  textMuted: string;
  /** Readable price / emphasis ink (prefers accent). */
  textEmphasis: string;
  /** Ink on primary-filled controls. */
  onPrimary: string;
  /** Opaque card surface that keeps body copy readable. */
  card: string;
  /** True when a preferred brand text color was replaced for contrast. */
  adjustedText: boolean;
  adjustedEmphasis: boolean;
  style: CSSProperties;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeBrandHex(input: string | null | undefined, fallback: string): string {
  const raw = (input ?? "").trim();
  if (!HEX.test(raw)) return fallback;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return raw.toUpperCase();
}

/** Opaque card that stays light/dark with the page surface. */
export function cardSurfaceOn(background: string): string {
  const lightSurface = (relativeLuminance(background) ?? 1) >= 0.5;
  return lightSurface ? "#FFFFFF" : "#1C1917";
}

/**
 * Resolve brand colors into a customer-facing surface stylesheet.
 * Prefer the venue's colors; fall back to black/white ink when they fail AA.
 */
export function resolveVenueBrandSurface(brand: VenueBrandColors = {}): ResolvedVenueBrandSurface {
  const primary = normalizeBrandHex(brand.primaryColor, DEFAULT_VENUE_BRAND.primaryColor);
  const secondaryRaw = normalizeBrandHex(brand.secondaryColor, DEFAULT_VENUE_BRAND.secondaryColor);
  const accentRaw = normalizeBrandHex(brand.accentColor, DEFAULT_VENUE_BRAND.accentColor);
  const surface = normalizeBrandHex(brand.neutralColor, DEFAULT_VENUE_BRAND.neutralColor);

  const text = readableInk(secondaryRaw, surface);
  const textEmphasis = readableInk(accentRaw, surface);
  const textMuted = mutedInkOn(surface);
  const onPrimary = inkOn(primary);
  const card = cardSurfaceOn(surface);
  const adjustedText = text.toUpperCase() !== secondaryRaw.toUpperCase();
  const adjustedEmphasis = textEmphasis.toUpperCase() !== accentRaw.toUpperCase();

  const style = {
    ...PUBLIC_FORM_LIGHT_VARS,
    colorScheme: "light",
    color: "var(--foreground)",
    backgroundColor: surface,
    // Raw brand for decorative borders / fills.
    "--venue-brand-primary": primary,
    "--venue-brand-secondary": secondaryRaw,
    "--venue-brand-accent": accentRaw,
    "--venue-brand-neutral": surface,
    // Semantic slots consumed by customer-facing renderers.
    // Secondary/accent slots carry readable ink so existing `color: var(--venue-*)`
    // call sites stay accessible without page-local overrides.
    "--venue-primary": primary,
    "--venue-secondary": text,
    "--venue-accent": textEmphasis,
    "--venue-neutral": surface,
    "--venue-on-primary": onPrimary,
    "--venue-card": card,
    "--venue-muted": textMuted,
    "--foreground": text,
    "--heading": text,
    "--muted-foreground": textMuted,
    "--card": card,
    "--card-foreground": text,
    "--primary": primary,
    "--primary-foreground": onPrimary,
    "--ring": primary,
    "--border": lightBorderOn(surface),
  } as CSSProperties;

  return {
    primary,
    secondaryRaw,
    accentRaw,
    surface,
    text,
    textMuted,
    textEmphasis,
    onPrimary,
    card,
    adjustedText,
    adjustedEmphasis,
    style,
  };
}

function lightBorderOn(background: string): string {
  const lightSurface = (relativeLuminance(background) ?? 1) >= 0.5;
  return lightSurface ? "#E7E5E4" : "#44403C";
}

/** CSSProperties helper for branded customer pages. */
export function venueBrandSurfaceStyle(brand: VenueBrandColors = {}): CSSProperties {
  return resolveVenueBrandSurface(brand).style;
}
