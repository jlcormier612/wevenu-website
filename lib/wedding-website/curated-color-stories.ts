/**
 * Wedding Website Setup — Color Story curation.
 *
 * The real schema ties every `color_stories` row to exactly one Collection
 * (`collection_id` is a required FK) — there is no collection-independent
 * palette catalog. That's the actual, confirmed reason Setup's old "Quick
 * start" list only ever showed 2-3 visually similar options: it filtered
 * to the couple's currently-chosen Collection's own small set.
 *
 * This module curates a fixed, collection-independent set of 12 for the
 * "Need a little inspiration?" section — 12 `color_stories` rows (all
 * scoped under Coastal's collection_id purely for the required FK; resolved
 * here by `key`, never by that FK, so the Collection they're stored under
 * is irrelevant to which Collection a couple actually has). Design System
 * Correction (2026-08-08) — these replace the previous, human-rejected
 * assortment entirely; this is not additive.
 *
 * Choosing one only ever writes the six raw hex override columns already
 * used by "design your own" (the existing `couple_websites.color_primary/
 * secondary/accent/neutral/background/text` persistence path) — never
 * `color_story_id`. A couple can start from any of these while keeping any
 * Collection at all, exactly like typing the hex in by hand.
 */
import type { CatalogColorStory, CatalogCollection } from "@/lib/wedding-website/types";

/** Canonical order — matches the exact approved curated Color Story set. */
export const CURATED_COLOR_STORY_KEYS: string[] = [
  "coastal-blue", "sage-garden", "dusty-rose", "peach-bellini", "lavender-haze",
  "champagne-curated", "terracotta-curated", "french-blue", "black-tie",
  "berry", "golden-hour", "meadow",
];

export type SixRoleColors = {
  colorPrimary: string; colorSecondary: string; colorAccent: string;
  colorNeutral: string; colorBackground: string; colorText: string;
};

/**
 * Exact approved six-role palettes (Hosted Experience design audit /
 * visual QA matrix). Do not invent or rebalance — restore verbatim.
 * Seeded under Coastal via migration `20261393000000_restore_curated_color_stories.sql`.
 */
export const APPROVED_CURATED_COLOR_STORIES: ReadonlyArray<{
  key: string;
  name: string;
  roles: SixRoleColors;
}> = [
  { key: "coastal-blue", name: "Coastal Blue", roles: {
    colorPrimary: "#5F8299", colorSecondary: "#A8BEC8", colorAccent: "#315B70",
    colorNeutral: "#E8E1D7", colorBackground: "#F7F5F0", colorText: "#263A43",
  }},
  { key: "sage-garden", name: "Sage Garden", roles: {
    colorPrimary: "#BFCBB7", colorSecondary: "#DCE2D5", colorAccent: "#91A287",
    colorNeutral: "#EEEAE1", colorBackground: "#FAF8F3", colorText: "#465044",
  }},
  { key: "dusty-rose", name: "Dusty Rose", roles: {
    colorPrimary: "#E8CBCD", colorSecondary: "#F1DDDE", colorAccent: "#D8B3B7",
    colorNeutral: "#F5E9E7", colorBackground: "#FFFDFC", colorText: "#6A4D50",
  }},
  { key: "peach-bellini", name: "Peach Bellini", roles: {
    colorPrimary: "#F4C7B3", colorSecondary: "#F9DCCB", colorAccent: "#EFAE92",
    colorNeutral: "#FBE9DE", colorBackground: "#FFFCF8", colorText: "#704F43",
  }},
  { key: "lavender-haze", name: "Lavender Haze", roles: {
    colorPrimary: "#8B74A5", colorSecondary: "#B9A7CB", colorAccent: "#654D7C",
    colorNeutral: "#E7DEEC", colorBackground: "#FBF8FC", colorText: "#3D3447",
  }},
  { key: "champagne-curated", name: "Champagne", roles: {
    colorPrimary: "#B8AD9F", colorSecondary: "#D4CCC1", colorAccent: "#948779",
    colorNeutral: "#E8E2DA", colorBackground: "#FCFAF7", colorText: "#4D4944",
  }},
  { key: "terracotta-curated", name: "Terracotta", roles: {
    colorPrimary: "#B9684E", colorSecondary: "#D79A7E", colorAccent: "#8D4938",
    colorNeutral: "#E9D5C4", colorBackground: "#FBF6EF", colorText: "#4B352E",
  }},
  { key: "french-blue", name: "French Blue", roles: {
    colorPrimary: "#667FA5", colorSecondary: "#A9B8D0", colorAccent: "#405B83",
    colorNeutral: "#E2E5E8", colorBackground: "#FAFAF8", colorText: "#2D3748",
  }},
  { key: "black-tie", name: "Black Tie", roles: {
    colorPrimary: "#242321", colorSecondary: "#B7AA91", colorAccent: "#8A7352",
    colorNeutral: "#E5DED2", colorBackground: "#FAF8F3", colorText: "#1E1D1B",
  }},
  { key: "berry", name: "Berry", roles: {
    colorPrimary: "#7A2A42", colorSecondary: "#B85073", colorAccent: "#4E1A2C",
    colorNeutral: "#E3C7CC", colorBackground: "#FBF4F3", colorText: "#341019",
  }},
  { key: "golden-hour", name: "Golden Hour", roles: {
    colorPrimary: "#C49345", colorSecondary: "#DFC58D", colorAccent: "#8E672C",
    colorNeutral: "#EEE1C7", colorBackground: "#FCF8EE", colorText: "#493D2D",
  }},
  { key: "meadow", name: "Meadow", roles: {
    colorPrimary: "#6F8F55", colorSecondary: "#A8B96F", colorAccent: "#D3AD4F",
    colorNeutral: "#EEE1B8", colorBackground: "#FBF8EC", colorText: "#30462F",
  }},
];

/** Hosted Experience RC1, Part 2 (2026-08-15) — every `color_stories` row
 * (curated and native alike) now has authored `colorPrimary/Secondary/
 * Accent/Neutral/Background/Text` values (see migration
 * `20261202000000_wedding_website_color_story_six_roles.sql`). The
 * heuristic gradient-stop-extraction fallback this function used to fall
 * back to for native, non-curated rows has been removed entirely, along
 * with the color-distance/mixing helpers it alone depended on — derived
 * values, interpolation, and duplicated color-resolution logic are gone by
 * design, not just currently unused. This is now a straight, verbatim
 * read of authored data; every Color Story resolves identically. */
export function deriveSixRoles(tokens: CatalogColorStory["tokens"]): SixRoleColors {
  return {
    colorPrimary: tokens.colorPrimary, colorSecondary: tokens.colorSecondary, colorAccent: tokens.colorAccent,
    colorNeutral: tokens.colorNeutral, colorBackground: tokens.colorBackground, colorText: tokens.colorText,
  };
}

/** Design-lead visual QA pass (2026-08-14) — the Minimal family (Ivory/
 * Blush/Slate) intentionally stores `heroGradient: "none"`: correct for the
 * real page, whose flat, gradient-less background is exactly the point of
 * that Collection. But several Studio surfaces (quick-start swatch dots,
 * the Collection picker's own color preview) read `tokens.heroGradient`
 * straight into a CSS `background`, purely as decorative chrome to preview
 * a palette — there, the literal string "none" paints nothing at all, so
 * every one of those three stories' swatches silently went blank. This
 * synthesizes a real gradient from the story's own resolved roles whenever
 * there isn't already an authored one — decorative-chrome use only, never
 * for the actual page background.
 */
export function swatchGradient(tokens: CatalogColorStory["tokens"]): string {
  if (tokens.heroGradient && tokens.heroGradient !== "none") return tokens.heroGradient;
  const roles = deriveSixRoles(tokens);
  return `linear-gradient(160deg, ${roles.colorSecondary} 0%, ${roles.colorPrimary} 100%)`;
}

export function resolveCuratedColorStories(collections: CatalogCollection[]): (CatalogColorStory & { mood: string })[] {
  const allStories = collections.flatMap(c => c.colorStories);
  const out: (CatalogColorStory & { mood: string })[] = [];
  for (const key of CURATED_COLOR_STORY_KEYS) {
    const story = allStories.find(cs => cs.key === key);
    if (story) out.push({ ...story, mood: String((story.tokens as { mood?: string }).mood ?? "") });
  }
  return out;
}
