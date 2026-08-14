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
 * "Need a little inspiration?" section — 12 new `color_stories` rows (all
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

/** Canonical order — matches the exact spec order these were provided in.
 * Visual Acceptance Corrections (2026-08-08) — "meadow" removed (too close
 * to "sage-garden", both mid-tone muted greens); "berry" stays but its
 * stored tokens were revised deeper/richer (raspberry/wine/merlot) so it no
 * longer sits in the same territory as "dusty-rose".
 * Final Assortment Pass (2026-08-10) — "sage-garden" lightened into a pale,
 * dusty, romantic territory (alongside the lightened "dusty-rose"/"peach-
 * bellini"), which reopened room for a genuinely distinct fresh/grassy/sunny
 * "meadow" — restored here as a new, deliberately different palette, not a
 * resurrection of the old deleted row. Appended last so it fills the
 * six-row grid's final slot beside "golden-hour". Twelve, not eleven. */
export const CURATED_COLOR_STORY_KEYS: string[] = [
  "coastal-blue", "sage-garden", "dusty-rose", "peach-bellini", "lavender-haze",
  "champagne-curated", "terracotta-curated", "french-blue", "black-tie",
  "berry", "golden-hour", "meadow",
];

export type SixRoleColors = {
  colorPrimary: string; colorSecondary: string; colorAccent: string;
  colorNeutral: string; colorBackground: string; colorText: string;
};

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
