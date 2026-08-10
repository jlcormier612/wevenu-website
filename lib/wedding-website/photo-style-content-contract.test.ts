/**
 * Photo Style content contract — SAME N photos, different art direction.
 * Studio specimen canonical count = 6. Styles must not truncate the set.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

import { GalleryGrid, resolveTheme } from "@/components/wedding-website/wedding-website";
import { buildPreviewSite } from "@/lib/wedding-website/preview-site";
import {
  PHOTO_STYLE_CANONICAL_COUNT,
  resolveStudioPreviewPhotos,
} from "@/lib/wedding-website/studio-preview-content";
import type { CatalogCollection, CatalogPhotoStyle, CatalogTypographyStyle } from "@/lib/wedding-website/types";
import { PHASE_B_PHOTO_STYLE_TOKENS } from "@/lib/wedding-website/photo-style-phase-b-tokens";

function collection(): CatalogCollection {
  return {
    id: "id-classic",
    key: "classic",
    name: "classic",
    description: null,
    isPremium: false,
    sortOrder: 0,
    swatchAccent: null,
    layoutConfig: { galleryLayout: "grid" },
    colorStories: [],
  };
}

function photoStyle(key: string, tokens: CatalogPhotoStyle["tokens"]): CatalogPhotoStyle {
  return { id: `ps-${key}`, key, name: key, description: null, sortOrder: 0, tokens };
}

function themeFor(key: keyof typeof PHASE_B_PHOTO_STYLE_TOKENS) {
  return resolveTheme(
    buildPreviewSite({
      collection: collection(),
      photoStyle: photoStyle(key, PHASE_B_PHOTO_STYLE_TOKENS[key]!),
    }),
  );
}

function countImgs(html: string): number {
  return (html.match(/<img\b/g) ?? []).length;
}

describe("Photo Style content contract", () => {
  const specimen = resolveStudioPreviewPhotos();

  it("canonical specimen is exactly 6 distinct photos", () => {
    assert.equal(PHOTO_STYLE_CANONICAL_COUNT, 6);
    assert.equal(specimen.length, 6);
    assert.equal(new Set(specimen).size, 6);
  });

  it("changing style does not change the photo set identity", () => {
    const again = resolveStudioPreviewPhotos();
    assert.deepEqual(again, specimen);
  });

  for (const key of Object.keys(PHASE_B_PHOTO_STYLE_TOKENS) as (keyof typeof PHASE_B_PHOTO_STYLE_TOKENS)[]) {
    it(`${key} GalleryGrid renders all ${PHOTO_STYLE_CANONICAL_COUNT} specimen photos`, () => {
      const tc = themeFor(key);
      const html = renderToStaticMarkup(
        React.createElement(GalleryGrid, { photos: specimen, tc }),
      );
      assert.equal(countImgs(html), PHOTO_STYLE_CANONICAL_COUNT, `${key} truncated the photo set`);
    });
  }

  it("Minimal uses oval/circular framing (border-radius 50%)", () => {
    const tc = themeFor("minimal");
    assert.equal(tc.photoRadius, "50%");
    const html = renderToStaticMarkup(
      React.createElement(GalleryGrid, { photos: specimen, tc }),
    );
    assert.match(html, /50%/);
    assert.equal(countImgs(html), 6);
    // No tiny-thumbnail fallback (content-contract 9e7f364 regression).
    assert.doesNotMatch(html, /3\.75rem|4\.1rem|4\.6rem/);
  });

  it("Photo Style selection does not change typography tokens", () => {
    const base = collection();
    const typography: CatalogTypographyStyle = {
      id: "ty-1",
      key: "elegant",
      name: "Elegant",
      sortOrder: 0,
      tokens: {
        headingFont: "'EB Garamond', Georgia, serif",
        bodyFont: "'Lato', system-ui, sans-serif",
        headingItalic: false,
        fontUrl: "https://fonts.example/elegant.css",
        sampleLabel: "Elegant",
      },
    };
    for (const key of Object.keys(PHASE_B_PHOTO_STYLE_TOKENS)) {
      const tc = resolveTheme(
        buildPreviewSite({
          collection: base,
          typography,
          photoStyle: photoStyle(key, PHASE_B_PHOTO_STYLE_TOKENS[key]!),
        }),
      );
      assert.equal(tc.headingFont, typography.tokens.headingFont, `${key} changed headingFont`);
      assert.equal(tc.bodyFont, typography.tokens.bodyFont, `${key} changed bodyFont`);
      assert.equal(tc.fontUrl, typography.tokens.fontUrl, `${key} changed fontUrl`);
      assert.equal(tc.headingItalic, false, `${key} changed headingItalic`);
    }
  });
});

describe("WW-AUDIT-03 narrow gallery layouts", () => {
  const specimen = resolveStudioPreviewPhotos();

  it("Magazine stacks below 480cqw and keeps all 6 photos (no forced 2-col style)", () => {
    const tc = themeFor("magazine");
    const html = renderToStaticMarkup(
      React.createElement(GalleryGrid, { photos: specimen, tc }),
    );
    assert.equal(countImgs(html), PHOTO_STYLE_CANONICAL_COUNT);
    assert.match(html, /grid-cols-1/);
    assert.match(html, /@min-\[480px\]\/wedding:grid-cols-\[1\.35fr_1fr\]/);
    assert.doesNotMatch(html, /grid-template-columns:\s*1\.35fr\s+1fr/);
    assert.match(html, /50%\s+35%/);
  });

  it("Editorial stacks below 480cqw and softens face crop", () => {
    const tc = themeFor("editorial");
    const html = renderToStaticMarkup(
      React.createElement(GalleryGrid, { photos: specimen, tc }),
    );
    assert.equal(countImgs(html), PHOTO_STYLE_CANONICAL_COUNT);
    assert.match(html, /grid-cols-1/);
    assert.match(html, /@min-\[480px\]\/wedding:grid-cols-\[1\.55fr_1fr\]/);
    assert.doesNotMatch(html, /grid-template-columns:\s*1\.55fr\s+1fr/);
    assert.match(html, /50%\s+22%/);
  });

  it("Minimal collapses 3-col oval band under 480cqw without tiny thumbs", () => {
    const tc = themeFor("minimal");
    const html = renderToStaticMarkup(
      React.createElement(GalleryGrid, { photos: specimen, tc }),
    );
    assert.equal(countImgs(html), PHOTO_STYLE_CANONICAL_COUNT);
    assert.match(html, /grid-cols-2/);
    assert.match(html, /@min-\[480px\]\/wedding:grid-cols-\[1\.15fr_0\.72fr_0\.95fr\]/);
    assert.doesNotMatch(html, /grid-template-columns:\s*1\.15fr\s+0\.72fr\s+0\.95fr/);
    assert.match(html, /50%/);
    assert.doesNotMatch(html, /3\.75rem|4\.1rem|4\.6rem/);
  });

  it("Film / Modern / Luxury ≥720 art direction unchanged (no Mag/Edit stack)", () => {
    for (const key of ["film", "modern", "luxury"] as const) {
      const html = renderToStaticMarkup(
        React.createElement(GalleryGrid, { photos: specimen, tc: themeFor(key) }),
      );
      assert.equal(countImgs(html), PHOTO_STYLE_CANONICAL_COUNT, `${key} photo count`);
      assert.doesNotMatch(html, /@min-\[480px\]\/wedding:grid-cols-\[1\.35fr_1fr\]/);
      assert.doesNotMatch(html, /@min-\[480px\]\/wedding:grid-cols-\[1\.55fr_1fr\]/);
      assert.doesNotMatch(html, /@min-\[480px\]\/wedding:grid-cols-\[1\.15fr_0\.72fr_0\.95fr\]/);
    }
  });

  it("Magazine vs Editorial keep distinct wide silhouettes (picker ≥480cqw DNA)", () => {
    const mag = renderToStaticMarkup(
      React.createElement(GalleryGrid, { photos: specimen, tc: themeFor("magazine") }),
    );
    const edit = renderToStaticMarkup(
      React.createElement(GalleryGrid, { photos: specimen, tc: themeFor("editorial") }),
    );
    // Wide branches differ — Mag page-spread vs Editorial essay ratios.
    // PhotoStylePreview floors ScaledThumbnail naturalWidth to ≥480 so picker
    // cards activate these, while live phone/published still stack <480cqw.
    assert.match(mag, /@min-\[480px\]\/wedding:grid-cols-\[1\.35fr_1fr\]/);
    assert.match(edit, /@min-\[480px\]\/wedding:grid-cols-\[1\.55fr_1fr\]/);
    assert.notEqual(
      mag.match(/@min-\[480px\]\/wedding:grid-cols-\[[^\]]+\]/)?.[0],
      edit.match(/@min-\[480px\]\/wedding:grid-cols-\[[^\]]+\]/)?.[0],
    );
    // Mag fleet must keep aspect-intrinsic sizing — flex-fill + height:100%
    // collapses in ScaledThumbnail auto-height parents (cream + photo sliver).
    assert.match(mag, /flex:\s*0\s+0\s+auto/);
    assert.match(mag, /aspect-ratio:\s*5\s*\/\s*4/);
    assert.doesNotMatch(mag, /flex:\s*1\s+1\s+0/);
  });

  it("Wildflower organic cluster stays width-contained (no edge-clip path)", () => {
    const html = renderToStaticMarkup(
      React.createElement(GalleryGrid, { photos: specimen, tc: themeFor("wildflower") }),
    );
    assert.equal(countImgs(html), PHOTO_STYLE_CANONICAL_COUNT);
    // Right-biased stagger via auto margin (not additive % left that overflows).
    assert.match(html, /margin-left:\s*auto/);
    assert.match(html, /min-width:\s*0/);
    // No ultra-wide 16/10 window that amputates faces inside short cover crops.
    assert.doesNotMatch(html, /16\s*\/\s*10/);
    // Softened face focal for landscape/short cells (WW-AUDIT-03 family).
    assert.match(html, /50%\s+22%/);
    // Legacy overflowing left-push recipe must not return.
    assert.doesNotMatch(html, /margin-left:\s*10%/);
    assert.doesNotMatch(html, /width:\s*54%/);
  });
});

describe("PhotoStylePreview picker thumb width", () => {
  it("floors ScaledThumbnail @container/wedding to ≥480 even if caller passes 420", async () => {
    const { PhotoStylePreview } = await import("@/components/portal/collection-preview");
    const html = renderToStaticMarkup(
      React.createElement(PhotoStylePreview, {
        collection: collection(),
        photoStyle: photoStyle("magazine", PHASE_B_PHOTO_STYLE_TOKENS.magazine!),
        photos: resolveStudioPreviewPhotos(),
        width: 226,
        height: 188,
        naturalWidth: 420,
      }),
    );
    assert.match(html, /width:\s*480px/);
    assert.doesNotMatch(html, /width:\s*420px/);
  });
});
