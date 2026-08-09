/**
 * Shared Rendering Architecture, Phase 2 — the one place a preview builds a
 * candidate `PublicWebsite` to feed the real shared primitives
 * (`resolveTheme`, `Hero`, `createSectionRenderer`, `GalleryGrid`, all in
 * wedding-website.tsx). Every preview that wants to show "what would
 * Collection/Color Story/Typography/Photo Style X look like" constructs its
 * candidate through this function — never by hand-deriving colors, fonts,
 * or layout shape itself.
 *
 * `deriveSixRoles` is not a competing color-resolution system: it is the
 * one place a Color Story's raw tokens become six named roles (verbatim for
 * curated stories, synthesized-but-never-duplicate for the ~26 native
 * per-Collection stories that predate six-role authoring — see
 * curated-color-stories.ts). Writing its output into the candidate's raw
 * colorPrimary/Secondary/Accent/Neutral/Background/Text columns is exactly
 * what "applying" a Color Story for real already does elsewhere in this
 * app (ThemeStudio's and the Wizard's own save handlers) — resolveTheme()
 * gives those raw columns top precedence over its own legacy palette
 * fallback, so this is the only way a preview and a real save produce the
 * same resolved theme for the same story.
 */
import type {
  PublicWebsite, WebsiteContent, CatalogCollection, CatalogColorStory,
  CatalogTypographyStyle, CatalogPhotoStyle, CollectionLayoutConfig,
} from "@/lib/wedding-website/types";
import { deriveSixRoles } from "@/lib/wedding-website/curated-color-stories";

export function buildPreviewSite(opts: {
  /** An existing real site to override fields on top of (e.g. the Wizard's
   * own `livePreviewSite`) — omit to build a minimal candidate from scratch. */
  base?: PublicWebsite;
  content?: WebsiteContent;
  collection?: CatalogCollection;
  colorStory?: CatalogColorStory;
  typography?: CatalogTypographyStyle;
  photoStyle?: CatalogPhotoStyle;
  /**
   * Thumbnail pickers only — forces `animationStyle: "none"` so
   * IntersectionObserver scroll-reveal cannot leave sections blank.
   * Never use for Live Preview / published rendering.
   */
  disableAnimation?: boolean;
}): PublicWebsite {
  const roles = opts.colorStory ? deriveSixRoles(opts.colorStory.tokens) : null;

  let layoutConfig: CollectionLayoutConfig | undefined = opts.collection
    ? { ...opts.collection.layoutConfig }
    : opts.base?.layoutConfig
      ? { ...opts.base.layoutConfig }
      : undefined;
  if (opts.disableAnimation) {
    layoutConfig = { ...(layoutConfig ?? {}), animationStyle: "none" };
  }

  return {
    ...(opts.base ?? {}),
    ...(opts.content !== undefined ? { content: opts.content } : {}),
    ...(opts.collection ? {
      // Hardcode DNA (e.g. Coastal heroAspectCap) keys off site.theme —
      // without this, every Collection preview silently inherits classic.
      theme: opts.collection.key as PublicWebsite["theme"],
      layoutConfig,
    } : (layoutConfig ? { layoutConfig } : {})),
    ...(opts.colorStory ? {
      colorTokens: opts.colorStory.tokens,
      colorPrimary: roles!.colorPrimary, colorSecondary: roles!.colorSecondary, colorAccent: roles!.colorAccent,
      colorNeutral: roles!.colorNeutral, colorBackground: roles!.colorBackground, colorText: roles!.colorText,
    } : {}),
    ...(opts.typography ? { typographyTokens: opts.typography.tokens } : {}),
    ...(opts.photoStyle ? { photoStyleTokens: opts.photoStyle.tokens } : {}),
  };
}
