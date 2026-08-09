/**
 * Pure theme adjustments for CollectionPreview cards.
 * Keeps Shared Rendering Architecture: same ThemeConfig → Hero / sections,
 * only the preview framing contract (height pin vs aspect-cap honesty).
 */

export type PreviewHeroThemeInput = {
  heroType: "full-bleed" | "invitation" | "inset" | string;
  heroAspectCap?: string;
  heroMinHeight?: string;
  heroMaxHeight?: string;
  [k: string]: unknown;
};

/**
 * Studio cards must not destroy Collection-defining geometry.
 * - invitation: keep suite DNA (no flat clamp that collapses photo+paper)
 * - aspect-cap Collections (Coastal / Midnight cinematic): KEEP heroAspectCap;
 *   pin maxHeight to the card hero budget so wide silhouette survives
 * - inset / full-bleed without aspect-cap: pin min=max height as before
 */
export function resolveCollectionPreviewTheme<T extends PreviewHeroThemeInput>(
  resolved: T,
  heroPx: string,
): T {
  if (resolved.heroType === "invitation") {
    return {
      ...resolved,
      heroAspectCap: undefined,
      heroMinHeight: heroPx,
      heroMaxHeight: undefined,
    };
  }

  if (resolved.heroAspectCap) {
    return {
      ...resolved,
      // Honest wide / cinematic band: aspect-ratio drives height; card budget
      // is a ceiling so ScaledThumbnail still crops predictably.
      heroMinHeight: undefined,
      heroMaxHeight: heroPx,
    };
  }

  return {
    ...resolved,
    heroMinHeight: heroPx,
    heroMaxHeight: heroPx,
  };
}
