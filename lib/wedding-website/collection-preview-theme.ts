/**
 * Pure theme adjustments for CollectionPreview cards.
 * Keeps Shared Rendering Architecture: same ThemeConfig → Hero / sections,
 * only the preview framing contract (height pin vs aspect-cap honesty) and
 * Photo Style honesty (Collections never invent a B&W / filter / tint mood).
 */

export type PreviewHeroThemeInput = {
  heroType: "full-bleed" | "invitation" | "inset" | string;
  heroAspectCap?: string;
  heroMinHeight?: string;
  heroMaxHeight?: string;
  /** Present on ThemeConfig — overridden to none for Collection pickers. */
  photoFilter?: string;
  /** Color-Story / Collection palette washes — neutralized for pickers. */
  heroOverlayColor?: string;
  heroOverlayOpacity?: number;
  [k: string]: unknown;
};

/**
 * Neutral photographic treatment shared by every Collection picker card.
 * Hero applies `Math.max(tc.heroOverlayOpacity, 0.2)` over cover photos for
 * type legibility — we pin the same black floor so Midnight/Rosé/Estate
 * palette washes cannot diverge perceived photo color/shade.
 */
export const COLLECTION_PREVIEW_NEUTRAL_PHOTO = {
  photoFilter: "none" as const,
  heroOverlayColor: "#000000",
  heroOverlayOpacity: 0.2,
};

/**
 * Studio cards must not destroy Collection-defining geometry.
 * - invitation: keep suite DNA (no flat clamp that collapses photo+paper)
 * - aspect-cap Collections (Coastal / Midnight cinematic): KEEP heroAspectCap;
 *   pin maxHeight to the card hero budget so wide silhouette survives
 * - inset / full-bleed without aspect-cap: pin min=max height as before
 *
 * Photo honesty: Collection pickers answer layout DNA (hero geometry,
 * type hierarchy, story treatment, colors/fonts). photoFilter belongs to the
 * independent Photo Style dimension. Without stripping, resolveTheme falls
 * back to legacy COLLECTIONS[`minimal`].photoFilter = grayscale(1) (and
 * similar mood filters on Midnight/Industrial), teaching couples that
 * "Linen = black & white" while Live Preview (with Photo Style tokens)
 * stays full color.
 *
 * Overlay honesty: even with photoFilter none, Hero paints Color Story /
 * Collection palette `heroOverlayColor` at divergent opacities (Midnight
 * ~0.5–0.6 black, Rosé warm/#2A1028, Estate cooler blues, etc.). That
 * remaining wash is why picker cards still looked like different photo
 * grades after the first photoFilter pass.
 */
// Release Readiness Reconciliation remediation: every branch below always
// touches heroMinHeight/heroMaxHeight (and the invitation branch always
// sets heroAspectCap too), regardless of whether the caller's own `T`
// happened to include them — bare `T` as the return type let the result's
// inferred shape stay as narrow as whatever the caller passed in, so a
// caller that omitted e.g. heroMaxHeight from its input literal couldn't
// type-safely read it off the result even though it's always really there.
export function resolveCollectionPreviewTheme<T extends PreviewHeroThemeInput>(
  resolved: T,
  heroPx: string,
): T & Pick<PreviewHeroThemeInput, "heroMinHeight" | "heroMaxHeight" | "heroAspectCap"> {
  const neutralPhoto = { ...COLLECTION_PREVIEW_NEUTRAL_PHOTO };

  if (resolved.heroType === "invitation") {
    return {
      ...resolved,
      ...neutralPhoto,
      heroAspectCap: undefined,
      heroMinHeight: heroPx,
      heroMaxHeight: undefined,
    };
  }

  if (resolved.heroAspectCap) {
    return {
      ...resolved,
      ...neutralPhoto,
      // Honest wide / cinematic band: aspect-ratio drives height; card budget
      // is a ceiling so ScaledThumbnail still crops predictably.
      heroMinHeight: undefined,
      heroMaxHeight: heroPx,
    };
  }

  return {
    ...resolved,
    ...neutralPhoto,
    heroMinHeight: heroPx,
    heroMaxHeight: heroPx,
  };
}
