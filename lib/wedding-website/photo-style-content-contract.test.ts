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
import type { CatalogCollection, CatalogPhotoStyle } from "@/lib/wedding-website/types";
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
    // Must not be a rectangles-only fallback (no circular language).
    assert.ok(!html.includes('border-radius:0') || html.includes("50%"));
  });
});
