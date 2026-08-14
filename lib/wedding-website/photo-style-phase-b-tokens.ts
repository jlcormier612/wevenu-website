/**
 * Photo Style Composition Phase B catalog DNA — shared by resolveTheme DNA
 * tests and the content-contract suite. Mirrors migration recipes
 * (content contract updates Minimal photoRadius to 50%).
 */
import type { CatalogPhotoStyle } from "@/lib/wedding-website/types";

export const PHASE_B_PHOTO_STYLE_TOKENS: Record<string, CatalogPhotoStyle["tokens"]> = {
  editorial: {
    shadow: "none", spacing: "tight", rotation: "none", frameStyle: "none",
    imageScale: "large", arrangement: "uniform",
    photoFilter: "contrast(1.08) saturate(1.02)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "hero-emphasis",
  },
  magazine: {
    shadow: "soft", spacing: "tight", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "collage",
    photoFilter: "contrast(1.06) saturate(1.02)",
    photoRadius: "0.15rem", captionStyle: "minimal", scalePattern: "uniform",
  },
  film: {
    shadow: "none", spacing: "tight", rotation: "none", frameStyle: "border",
    imageScale: "normal", arrangement: "uniform",
    photoFilter: "sepia(0.28) saturate(0.78) contrast(0.92) brightness(1.05)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "uniform",
  },
  minimal: {
    shadow: "none", spacing: "generous", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "sparse",
    photoFilter: "saturate(0.88) brightness(1.04)",
    photoRadius: "50%", captionStyle: "none", scalePattern: "uniform",
  },
  modern: {
    shadow: "none", spacing: "normal", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "uniform",
    photoFilter: "none",
    photoRadius: "0", captionStyle: "none", scalePattern: "uniform",
  },
  luxury: {
    shadow: "soft", spacing: "generous", rotation: "none", frameStyle: "border",
    imageScale: "large", arrangement: "uniform",
    photoFilter: "contrast(1.02) saturate(0.94) brightness(1.02)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "hero-emphasis",
  },
  scrapbook: {
    shadow: "soft", spacing: "normal", rotation: "subtle", frameStyle: "polaroid",
    imageScale: "normal", arrangement: "scrapbook",
    photoFilter: "saturate(1.08) brightness(1.04) contrast(0.98)",
    photoRadius: "0.25rem", captionStyle: "handwritten", scalePattern: "uniform",
  },
  wildflower: {
    shadow: "soft", spacing: "normal", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "uniform",
    photoFilter: "saturate(1.1) contrast(0.95) brightness(1.03) sepia(0.06)",
    photoRadius: "0.85rem", captionStyle: "none", scalePattern: "alternating",
  },
  midnight: {
    shadow: "none", spacing: "tight", rotation: "none", frameStyle: "none",
    imageScale: "large", arrangement: "uniform",
    photoFilter: "brightness(0.68) contrast(1.32) saturate(0.65)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "hero-emphasis",
  },
  gallery_wall: {
    shadow: "lifted", spacing: "normal", rotation: "none", frameStyle: "border",
    imageScale: "normal", arrangement: "gallery-wall",
    photoFilter: "contrast(1.04) saturate(0.96)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "uniform",
  },
};
