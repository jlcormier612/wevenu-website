/**
 * Studio thumbnail preview content — Emma & Jordan / Sweet Daisy Barn & Farm.
 *
 * Preview candidates only. Never write this into saves, drafts, published
 * sites, or version history. Callers must merge through buildPreviewSite /
 * CollectionPreview / PhotoStylePreview, never through onSaveSection or
 * design patches.
 */
import type { WebsiteContent } from "@/lib/wedding-website/types";

export const STUDIO_PREVIEW_COUPLE_NAME = "Emma & Jordan";
export const STUDIO_PREVIEW_VENUE = "Sweet Daisy Barn & Farm";

/**
 * Canonical Photo Style specimen size for Studio comparison cards.
 * Content count is a content contract — not a style contract.
 * Live/published GalleryGrid still renders every photo the couple uploaded;
 * Studio specimens normalize to this count so all 10 styles art-direct the
 * same set (6 fills Film’s 3-col sheet exactly — no ghost cream tracks).
 */
export const PHOTO_STYLE_CANONICAL_COUNT = 6;

/**
 * Live Preview may show up to this many distinct couple photos when available
 * so Film’s densest 3×3 contact sheet can fill when sources allow. Layout
 * packing still handles any remainder without empty cells.
 */
export const PHOTO_STYLE_PREVIEW_MAX_COUNT = 9;

/** Short enough for quote / minimal / EditorialOpening to diverge in a card. */
export const STUDIO_PREVIEW_STORY_TEXT =
  "We met on a rainy Tuesday at a coffee shop that no longer exists, and somehow every season since has felt like the beginning of something we already knew. Now we're gathering everyone we love at Sweet Daisy Barn & Farm to say yes to forever.";

/** Portrait / venue / detail silhouettes — used only when the couple has fewer than the specimen minimum. */
function svgPhoto(w: number, h: number, c1: string, c2: string, accent: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<circle cx="${Math.round(w * 0.35)}" cy="${Math.round(h * 0.4)}" r="${Math.round(Math.min(w, h) * 0.18)}" fill="${accent}" opacity="0.35"/>` +
    `<rect x="${Math.round(w * 0.55)}" y="${Math.round(h * 0.55)}" width="${Math.round(w * 0.3)}" height="${Math.round(h * 0.28)}" rx="8" fill="${accent}" opacity="0.25"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const STUDIO_PREVIEW_FILLER_PHOTOS: string[] = [
  svgPhoto(720, 960, "#C4A484", "#8B6F5C", "#F5E6D3"), // portrait
  svgPhoto(960, 640, "#7A8B6F", "#4A5C3A", "#D9E2C8"), // venue / landscape
  svgPhoto(800, 800, "#BFA8A0", "#6E4E4E", "#F0E4DC"), // detail / square
  svgPhoto(880, 720, "#8FA3B0", "#3D5566", "#D6E4EC"), // soft blue
  svgPhoto(700, 900, "#C9A9BE", "#6B4A5E", "#F3E4EC"), // mauve
  svgPhoto(920, 700, "#D4C4A8", "#7A6A4E", "#F5EFE0"), // warm sand
];

/**
 * Merge representative Emma & Jordan story (and default couple title when
 * missing) into a preview-only WebsiteContent. Existing couple content wins.
 */
export function mergeStudioPreviewContent(content?: WebsiteContent | null): WebsiteContent {
  const base = content ?? {};
  const title = base.home?.title?.trim();
  const storyText = base.story?.text?.trim();
  return {
    ...base,
    home: {
      ...base.home,
      title: title || STUDIO_PREVIEW_COUPLE_NAME,
    },
    story: {
      ...base.story,
      title: base.story?.title?.trim() || "How it began",
      text: storyText || STUDIO_PREVIEW_STORY_TEXT,
    },
  };
}

/**
 * Distinct photo URLs for Photo Style GalleryGrid previews.
 * Prefer couple gallery → cover → engagement, then representative fillers.
 * Pads to the canonical 6-photo specimen when sources are thin; when the
 * couple has more, includes up to PHOTO_STYLE_PREVIEW_MAX_COUNT (Film 3×3).
 */
export function resolveStudioPreviewPhotos(opts: {
  galleryPhotos?: string[] | null;
  coverPhoto?: string | null;
  engagementPhotos?: string[] | null;
  minCount?: number;
  maxCount?: number;
} = {}): string[] {
  const minCount = opts.minCount ?? PHOTO_STYLE_CANONICAL_COUNT;
  const maxCount = opts.maxCount ?? PHOTO_STYLE_PREVIEW_MAX_COUNT;
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (url?: string | null) => {
    const u = url?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  for (const url of opts.galleryPhotos ?? []) push(url);
  push(opts.coverPhoto);
  for (const url of opts.engagementPhotos ?? []) push(url);
  for (const url of STUDIO_PREVIEW_FILLER_PHOTOS) {
    if (out.length >= minCount) break;
    push(url);
  }

  while (out.length > 0 && out.length < minCount) out.push(out[0]!);
  return out.slice(0, maxCount);
}
