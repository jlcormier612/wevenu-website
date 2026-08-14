/**
 * Collection → Color Story identity bundling.
 *
 * Most Collections keep Color Story independent (Studio Canonical State).
 * Midnight (`modern`) and Velvet are exceptions: their name/descriptor promise
 * nocturnal / candlelit mood, which is carried by Color Story tokens — layout
 * DNA alone can leave a light paper story chamber. Selecting either therefore
 * rebundles a real dark Color Story so Live Preview matches the promise
 * (Midnight A+C 2026-08-10; Velvet follows the same pattern).
 */
import type { CatalogCollection, CatalogColorStory } from "@/lib/wedding-website/types";
import { deriveSixRoles, type SixRoleColors } from "@/lib/wedding-website/curated-color-stories";

/** Collections that must ship a dark Color Story whenever selected. */
export const DARK_BUNDLE_COLLECTION_KEYS = ["modern", "velvet"] as const;

export type DarkBundleCollectionKey = (typeof DARK_BUNDLE_COLLECTION_KEYS)[number];

export function bundlesDarkColorStoryOnSelect(collectionKey: string): boolean {
  return (DARK_BUNDLE_COLLECTION_KEYS as readonly string[]).includes(collectionKey);
}

/** Preferred dark story keys for Midnight — native first, then darkened curated Black Tie. */
const MIDNIGHT_DARK_STORY_KEYS = ["onyx", "indigo", "plum", "black-tie"] as const;

/** Preferred dark story keys for Velvet — wine/noir natives first, then Black Tie. */
const VELVET_DARK_STORY_KEYS = ["burgundy", "noir", "plum", "black-tie"] as const;

const DARK_STORY_KEYS_BY_COLLECTION: Record<DarkBundleCollectionKey, readonly string[]> = {
  modern: MIDNIGHT_DARK_STORY_KEYS,
  velvet: VELVET_DARK_STORY_KEYS,
};

/**
 * Resolve the Color Story to apply when selecting `collection`.
 * For Midnight: prefer Onyx → Indigo → Plum → Black Tie (darkened).
 * For Velvet: prefer Burgundy → Noir → Plum → Black Tie (darkened).
 * Otherwise: undefined (caller keeps independence / first-time seed rules).
 */
export function resolveBundledColorStory(
  collection: CatalogCollection,
  allStories: CatalogColorStory[],
): CatalogColorStory | undefined {
  if (!bundlesDarkColorStoryOnSelect(collection.key)) return undefined;

  const preferred = DARK_STORY_KEYS_BY_COLLECTION[collection.key as DarkBundleCollectionKey];
  for (const key of preferred) {
    const native = collection.colorStories.find((s) => s.key === key);
    if (native) return native;
    const global = allStories.find((s) => s.key === key);
    if (global) return global;
  }
  return collection.colorStories[0];
}

/** Design patch fields for a bundled Color Story (six roles + ids). */
export function colorStoryBundlePatch(story: CatalogColorStory): {
  colorStoryId: string;
  themePalette: string;
  clearCustomColors: false;
} & SixRoleColors {
  const roles = deriveSixRoles(story.tokens);
  return {
    colorStoryId: story.id,
    themePalette: story.name,
    clearCustomColors: false,
    ...roles,
  };
}
