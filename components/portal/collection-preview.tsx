"use client";

/**
 * Wedding Website Setup — preview components for Collection, Color Story,
 * Typography, and Photo Style.
 *
 * Shared Rendering Architecture, Phase 2 (2026-08-06) — every component in
 * this file is a thin layout wrapper around the primitives extracted in
 * Phase 1 (`Hero`, `createSectionRenderer`, `GalleryGrid`, `useThemeFonts`,
 * `resolveTheme`, all from wedding-website.tsx) plus `buildPreviewSite`
 * (lib/wedding-website/preview-site.ts), which turns a catalog row into the
 * candidate `PublicWebsite` those primitives expect. None of these
 * components decide hero layout, section composition, gallery arrangement,
 * font loading, or color resolution themselves — that would be exactly the
 * duplicated rendering logic this phase exists to remove. A preview's only
 * job is which primitives to call and how to arrange them in the available
 * space; see docs/wedding-website-shared-primitives.md for what changed and
 * why, component by component.
 */
import * as React from "react";
import { Hero, createSectionRenderer, GalleryGrid, useThemeFonts, resolveTheme, type ThemeConfig } from "@/components/wedding-website/wedding-website";
import { buildPreviewSite } from "@/lib/wedding-website/preview-site";
import type {
  PublicWebsite, WebsiteContent, CatalogCollection, CatalogColorStory,
  CatalogTypographyStyle, CatalogPhotoStyle,
} from "@/lib/wedding-website/types";

// Hero's real markup carries `rem`-based padding (`py-20` = 5rem top and
// bottom) and `clamp()` font-size floors (2.5rem/3rem minimums) — sized for
// a realistic page or phone-frame width, where that padding and type scale
// read as intentional. Neither shrinks to fit an 80×56px swatch: `min-
// height` alone can't help when the CONTENT (padding + a 40px-minimum
// headline) is already taller than the box. The standard fix for "a
// thumbnail of a fixed-size layout" is to render at a size the layout was
// actually designed for, then scale the whole rendered result down with a
// CSS transform — proportions (padding, type, spacing) all shrink together,
// instead of trying to renegotiate each one individually. This is layout
// composition, not a rendering decision: nothing about how Hero/Section
// paint their own content changes.
function ScaledThumbnail({ width, height, naturalWidth, children }: {
  width: number; height: number; naturalWidth: number; children: React.ReactNode;
}) {
  const scale = width / naturalWidth;
  const naturalHeight = height / scale;
  return (
    <div style={{ width, height, overflow: "hidden" }}>
      <div className="@container/wedding" style={{ width: naturalWidth, height: naturalHeight, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

// ── Collection Preview ──────────────────────────────────────────────────────
// Replaces CollectionMiniPreview and CollectionHeroChip — see the
// duplication table in docs/wedding-website-shared-primitives.md. Renders
// the real Hero (and, when a section key is supplied, real Section content)
// for a candidate Collection, at natural (page-realistic) scale, shrunk to
// fit the caller's box via ScaledThumbnail.
export function CollectionPreview({ base, content, collection, colorStory, typography, photoStyle, sectionKeys = [], width, height, naturalWidth = 320, heroFraction = 1 }: {
  base?: PublicWebsite;
  content?: WebsiteContent;
  collection: CatalogCollection;
  colorStory?: CatalogColorStory;
  typography?: CatalogTypographyStyle;
  photoStyle?: CatalogPhotoStyle;
  sectionKeys?: string[];
  width: number;
  height: number;
  /** The width Hero/Section actually render at before being scaled down to `width` — see ScaledThumbnail. */
  naturalWidth?: number;
  /** What fraction of the natural height the hero gets when sections are also shown below it. */
  heroFraction?: number;
}) {
  const site = buildPreviewSite({ base, content, collection, colorStory, typography, photoStyle });
  const naturalHeight = height / (width / naturalWidth);
  const heroPx = `${Math.round(naturalHeight * heroFraction)}px`;
  const tc: ThemeConfig = { ...resolveTheme(site), heroMinHeight: heroPx, heroMaxHeight: heroPx, heroAspectCap: undefined };
  const { renderSection } = createSectionRenderer({
    tc, content: site.content ?? {}, site, color: tc.primary, editMode: false, activeSection: null,
  });
  return (
    <ScaledThumbnail width={width} height={height} naturalWidth={naturalWidth}>
      <div style={{ background: tc.bg }}>
        <Hero site={site} tc={tc} />
        {sectionKeys.map(key => <React.Fragment key={key}>{renderSection(key)}</React.Fragment>)}
      </div>
    </ScaledThumbnail>
  );
}

// ── Color Story Preview ─────────────────────────────────────────────────────
// Replaces the inline six-band `deriveSixRoles(...).map(...)` bar that was
// hand-written twice (website-editor.tsx and website-studio.tsx). Reads the
// same six roles resolveTheme() resolves for the real page — see
// buildPreviewSite's own doc comment for why deriveSixRoles feeding into it
// is data-shaping, not a second color-resolution system. `base` shows
// whatever a real (or candidate) site is already carrying in its raw
// color* columns — the current-selection swatch uses this, since "custom
// colors" has no catalog row to pass as `colorStory`; `colorStory` previews
// one specific catalog row regardless of what's currently applied.
export function ColorStoryPreview({ colorStory, base }: { colorStory?: CatalogColorStory; base?: PublicWebsite }) {
  const tc = resolveTheme(buildPreviewSite({ base, colorStory }));
  const bands = [tc.primary, tc.secondary, tc.accent, tc.border, tc.bg, tc.text];
  return (
    <div className="flex w-full h-full">
      {bands.map((c, i) => <div key={i} className="flex-1 h-full" style={{ background: c }} />)}
    </div>
  );
}

// ── Typography Preview ──────────────────────────────────────────────────────
// Replaces the inline "couple name in headingFont / tagline in bodyFont"
// JSX that appeared in three places with no guaranteed font loading (each
// relied on some OTHER on-screen instance happening to have already
// requested the same stylesheet). useThemeFonts() is now reference-counted
// (Phase 2) specifically so a grid of these — each wanting a different
// font — can all call it safely at once.
export function TypographyPreview({ typography, coupleName, tagline, showTagline = true, nameSize = 15, taglineSize = 9, align = "center" }: {
  typography: CatalogTypographyStyle;
  coupleName: string;
  tagline?: string;
  /** The expanded picker grid's real layout has never shown a tagline row at all. */
  showTagline?: boolean;
  /** Layout-only sizing/alignment for the space available — never a font/rendering decision. */
  nameSize?: number;
  taglineSize?: number;
  align?: "center" | "left";
}) {
  useThemeFonts(typography.tokens.fontUrl);
  return (
    <div className={`w-full h-full flex flex-col ${align === "center" ? "items-center justify-center" : "items-start justify-start"} gap-1 px-1 overflow-hidden`}>
      <p className={`leading-tight truncate w-full max-w-full ${align === "center" ? "text-center" : "text-left"}`}
        style={{ fontFamily: typography.tokens.headingFont, fontStyle: typography.tokens.headingItalic ? "italic" : "normal", fontSize: nameSize }}>
        {coupleName}
      </p>
      {showTagline && (
        <p className={`leading-tight truncate w-full max-w-full opacity-55 ${align === "center" ? "text-center" : "text-left"}`}
          style={{ fontFamily: typography.tokens.bodyFont, fontSize: taglineSize }}>
          {tagline ?? "Two hearts, one beautiful beginning"}
        </p>
      )}
    </div>
  );
}

// ── Photo Style Preview ─────────────────────────────────────────────────────
// Replaces PhotoStyleMiniPreview — an entirely independent second geometry
// system for the same seven treatments GalleryGrid already implements for
// the real Photo Gallery section (a different implementation of the same
// conceptual axes, already caught drifting: CollectionHeroChip's old hero
// gradient formula omitted GalleryGrid's real middle color stop). Renders
// the couple's own real gallery photos when they have any; repeats the one
// cover photo they've chosen otherwise — never a synthetic per-slot crop
// trick, since GalleryGrid has no such thing and a preview must show
// exactly what the real Gallery section would do with the same photos.
export function PhotoStylePreview({ collection, photoStyle, photos, width, height, naturalWidth = 320 }: {
  collection: CatalogCollection;
  photoStyle: CatalogPhotoStyle;
  photos: string[];
  width: number;
  height: number;
  /** See CollectionPreview's ScaledThumbnail doc. */
  naturalWidth?: number;
}) {
  const tc = resolveTheme(buildPreviewSite({ collection, photoStyle }));
  if (photos.length === 0) return <div className="w-full h-full bg-muted" />;
  return (
    <ScaledThumbnail width={width} height={height} naturalWidth={naturalWidth}>
      <div style={{ background: tc.bg }}>
        <GalleryGrid photos={photos} tc={tc} />
      </div>
    </ScaledThumbnail>
  );
}
