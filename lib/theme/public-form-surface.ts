import type { CSSProperties } from "react";

/**
 * Public inquiry / tour forms / Client Portal Preview are a light brand surface.
 * next-themes (and dark staff `.htc-staff`) remap semantic tokens — including
 * `--natural-cream` → Heritage Sage — so a lock that only reassigns
 * `--muted: var(--natural-cream)` still paints dark green. Re-pin the palette
 * hexes first, then the semantic tokens, so every descendant resolves light
 * readable ink even when an ancestor remapped cream/background.
 */
export const PUBLIC_FORM_LIGHT_VARS = {
  /* Palette anchors — must be hex, not var(), or dark staff remaps win */
  "--true-white": "#ffffff",
  "--black": "#000000",
  "--natural-cream": "#f7f5f1",
  "--linen": "#f5f4f2",
  "--soft-sage": "#b9d1c2",
  "--heritage-sage": "#5d6f5d",
  "--forest-sage": "#4f5f4f",
  "--taupe-light": "#ded6ca",
  "--taupe-medium": "#d2cbbf",
  "--taupe-dark": "#b8aea1",
  "--dusty-rose": "#d8a7aa",

  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--card": "var(--true-white)",
  "--card-foreground": "var(--black)",
  "--popover": "var(--true-white)",
  "--popover-foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted": "var(--natural-cream)",
  "--muted-foreground": "color-mix(in oklch, var(--forest-sage) 82%, transparent)",
  "--secondary": "var(--natural-cream)",
  "--secondary-foreground": "var(--forest-sage)",
  "--primary": "var(--heritage-sage)",
  "--primary-foreground": "var(--true-white)",
  "--accent": "var(--soft-sage)",
  "--accent-foreground": "var(--forest-sage)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
} as CSSProperties;

const BLACK = "#000000";
const WHITE = "#ffffff";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseHex(input: string): [number, number, number] | null {
  const raw = input.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  if (fg == null || bg == null) return null;
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Black or white, whichever clears more contrast on `background`. */
export function inkOn(background: string): string {
  const bg = relativeLuminance(background);
  if (bg == null) return "var(--foreground)";
  const white = (1 + 0.05) / (bg + 0.05);
  const black = (bg + 0.05) / 0.05;
  return black >= white ? BLACK : WHITE;
}

/**
 * Use `preferred` when it meets WCAG AA for body text on `background`.
 * Otherwise use palette black or white, whichever contrasts more.
 */
export function readableInk(preferred: string, background: string): string {
  const ratio = contrastRatio(preferred, background);
  if (ratio != null && ratio >= 4.5) return preferred;
  return inkOn(background);
}

/**
 * Soften ink toward the surface while staying at or above 4.5:1.
 * Deterministic candidate list — no random mixing.
 */
export function mutedInkOn(background: string): string {
  const ink = inkOn(background);
  const lightSurface = (relativeLuminance(background) ?? 1) >= 0.5;
  const candidates = lightSurface
    ? ["#4F5F4F", "#3D2F30", "#525252", "#1C1917", ink]
    : ["#D6D3D1", "#E7E5E4", "#F5F5F4", "#FAFAF9", ink];
  for (const candidate of candidates) {
    if ((contrastRatio(candidate, background) ?? 0) >= 4.5) return candidate;
  }
  return ink;
}

export function publicFormSurfaceStyle(
  brand:
    | string
    | {
        primary: string;
        secondary?: string;
        accent?: string;
        /** Soft venue-branded page surface — not HTC #F7F5F1 unless that is the venue's Neutral. */
        neutral?: string;
      },
): CSSProperties {
  const primary = typeof brand === "string" ? brand : brand.primary;
  const secondary = typeof brand === "string" ? undefined : brand.secondary;
  const accent = typeof brand === "string" ? undefined : brand.accent;
  const neutral = typeof brand === "string" ? undefined : brand.neutral;

  if (neutral) {
    const heading = secondary ? readableInk(secondary, neutral) : undefined;
    const muted = mutedInkOn(neutral);
    return {
      ...PUBLIC_FORM_LIGHT_VARS,
      color: "var(--foreground)",
      colorScheme: "light",
      backgroundColor: neutral,
      ...(heading ? ({ "--heading": heading, "--foreground": heading } as CSSProperties) : {}),
      "--muted-foreground": muted,
      ...(accent
        ? ({ "--ring": accent, "--accent": accent } as CSSProperties)
        : ({ "--ring": primary } as CSSProperties)),
      "--primary": primary,
      "--primary-foreground": inkOn(primary),
    } as CSSProperties;
  }

  return {
    ...PUBLIC_FORM_LIGHT_VARS,
    color: "var(--foreground)",
    colorScheme: "light",
    backgroundColor: `color-mix(in srgb, ${primary} 8%, var(--background))`,
    ...(secondary ? ({ "--heading": readableInk(secondary, "#ffffff") } as CSSProperties) : {}),
    ...(accent
      ? ({ "--ring": accent, "--accent": accent } as CSSProperties)
      : ({ "--ring": primary } as CSSProperties)),
    "--primary": primary,
    "--primary-foreground": inkOn(primary),
  } as CSSProperties;
}
