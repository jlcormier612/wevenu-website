/**
 * Studio Canonical State Pass (2026-08-11).
 *
 * Before this, "what is this couple's website currently set to" was
 * independently re-derived in at least four places — the wizard's
 * SelectedDesignSummary, the Studio's CollectionCarousel, ThemeStudio's
 * lower cards, and the wizard's own Color step — each with its own
 * `currentCollection?.colorStories.find(...)` and `hasCustomColors` logic.
 * Two bugs fell out of that duplication:
 *
 *  1. Curated Color Stories are all parked under one Collection's own
 *     `collection_id` (see curated-color-stories.ts) so they can be
 *     resolved by `key` regardless of which real Collection a couple has.
 *     Every one of those independent lookups scoped its search to
 *     `currentCollection.colorStories` instead, so a curated story picked
 *     while on a Collection other than the one it's parked under (e.g.
 *     Meadow + Garden Party) resolved to `undefined` everywhere — which
 *     also fed a hardcoded "#BF9089" fallback for several color roles at
 *     once, collapsing them to the same value.
 *  2. Nothing ever persisted `color_story_id` when a curated story was
 *     picked — only the six raw hex columns (needed for actual rendering
 *     either way) — so there was no way, after reload, to tell "curated
 *     Meadow, untouched" apart from "hand-customized colors that happen to
 *     match Meadow." Every summary fell back to treating any populated set
 *     of six columns as "Your Color Story"/"Custom colors."
 *
 * This is the one place that answers "what's currently selected" — every
 * surface that summarizes the couple's design (Studio top card, "Your
 * Website Style", the lower style cards, the wizard's own display) must
 * call this rather than re-deriving it.
 */
import type {
  CoupleWebsite, HostedExperienceCatalog, CatalogCollection, CatalogColorStory,
  CatalogTypographyStyle, CatalogPhotoStyle,
} from "@/lib/wedding-website/types";

export type ResolvedDesignState = {
  collection: CatalogCollection | undefined;
  /** The exact matched curated/catalog Color Story, or undefined if the
   * couple's colors are a hand-customized palette (or nothing is set yet). */
  colorStory: CatalogColorStory | undefined;
  /** True only when colors are set but don't trace back to a catalog
   * Color Story — i.e. the couple edited at least one role away from it. */
  isCustomColors: boolean;
  /** What to show as the Color Story's name anywhere in the UI. */
  colorStoryLabel: string;
  typography: CatalogTypographyStyle | undefined;
  photoStyle: CatalogPhotoStyle | undefined;
};

type DesignStateSite = Pick<CoupleWebsite,
  "collectionId" | "colorStoryId" | "typographyStyleId" | "photoStyleId" |
  "colorPrimary" | "colorSecondary" | "colorAccent" | "colorNeutral" | "colorBackground" | "colorText"
>;

export function resolveDesignState(site: DesignStateSite, catalog: HostedExperienceCatalog | null): ResolvedDesignState {
  const collection = catalog?.collections.find(c => c.id === site.collectionId);

  // Global search across every Collection's own Color Stories — never
  // scoped to `collection` above. See file header.
  const allColorStories = catalog?.collections.flatMap(c => c.colorStories) ?? [];
  const colorStory = site.colorStoryId ? allColorStories.find(cs => cs.id === site.colorStoryId) : undefined;

  const hasAnyColor = !!(
    site.colorPrimary || site.colorSecondary || site.colorAccent ||
    site.colorNeutral || site.colorBackground || site.colorText
  );
  // color_story_id is the source of truth for "curated, untouched" — not
  // whether the six hex columns are populated, since both a curated pick
  // and a hand-customized palette populate those same six columns.
  const isCustomColors = !colorStory && hasAnyColor;
  const colorStoryLabel = colorStory ? colorStory.name : isCustomColors ? "Custom colors" : "Default";

  const typography = catalog?.typographyStyles.find(t => t.id === site.typographyStyleId);
  const photoStyle = catalog?.photoStyles.find(p => p.id === site.photoStyleId);

  return { collection, colorStory, isCustomColors, colorStoryLabel, typography, photoStyle };
}
