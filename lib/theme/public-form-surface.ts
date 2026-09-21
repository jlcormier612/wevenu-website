import type { CSSProperties } from "react";

/**
 * Public inquiry / tour forms are a light brand surface. next-themes can put
 * `.dark` on <html> from the visitor's system preference, which remaps
 * --background to Forest Sage and --foreground to white. These forms still
 * paint light cards, so inherited white ink disappears and gray utilities
 * fail on the dark page. Re-pin the light tokens on the form root — the same
 * contract as venue login — so every descendant resolves readable ink.
 */
export const PUBLIC_FORM_LIGHT_VARS = {
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

export function publicFormSurfaceStyle(primary: string): CSSProperties {
  return {
    ...PUBLIC_FORM_LIGHT_VARS,
    color: "var(--foreground)",
    colorScheme: "light",
    backgroundColor: `color-mix(in srgb, ${primary} 8%, var(--background))`,
  };
}
