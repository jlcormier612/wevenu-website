/**
 * Photo Style Composition Phase B — resolveTheme token DNA + silhouette gates.
 * Mirrors migrations 20261237000000 + 20261240000000 (no live DB required).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTheme } from "@/components/wedding-website/wedding-website";
import { buildPreviewSite } from "@/lib/wedding-website/preview-site";
import { PHASE_B_PHOTO_STYLE_TOKENS } from "@/lib/wedding-website/photo-style-phase-b-tokens";
import type { CatalogCollection, CatalogPhotoStyle } from "@/lib/wedding-website/types";

function collection(key = "classic"): CatalogCollection {
  return {
    id: `id-${key}`,
    key,
    name: key,
    description: null,
    isPremium: false,
    sortOrder: 0,
    swatchAccent: null,
    layoutConfig: { galleryLayout: "grid" },
    colorStories: [],
  };
}

function photoStyle(key: string, tokens: CatalogPhotoStyle["tokens"]): CatalogPhotoStyle {
  return {
    id: `ps-${key}`,
    key,
    name: key,
    description: null,
    sortOrder: 0,
    tokens,
  };
}

function themeFor(key: keyof typeof PHASE_B_PHOTO_STYLE_TOKENS) {
  return resolveTheme(
    buildPreviewSite({
      collection: collection("classic"),
      photoStyle: photoStyle(key, PHASE_B_PHOTO_STYLE_TOKENS[key]!),
    }),
  );
}

describe("Photo Style Phase B resolveTheme DNA", () => {
  it("Minimal is sparse with oval/circular frames (not rectangles-only)", () => {
    const tc = themeFor("minimal");
    assert.equal(tc.arrangement, "sparse");
    assert.equal(tc.photoRadius, "50%");
    assert.equal(tc.photoSpacing, "generous");
    assert.equal(tc.frameStyle, "none");
  });

  it("Gallery Wall uses gallery-wall arrangement (≠ Magazine collage)", () => {
    const wall = themeFor("gallery_wall");
    const mag = themeFor("magazine");
    assert.equal(wall.arrangement, "gallery-wall");
    assert.equal(mag.arrangement, "collage");
    assert.equal(wall.frameStyle, "border");
    assert.equal(mag.frameStyle, "none");
    assert.equal(wall.shadow, "lifted");
  });

  it("Editorial vs Luxury differ by structure tokens", () => {
    const ed = themeFor("editorial");
    const lux = themeFor("luxury");
    assert.equal(ed.scalePattern, "hero-emphasis");
    assert.equal(lux.scalePattern, "hero-emphasis");
    assert.equal(ed.frameStyle, "none");
    assert.equal(lux.frameStyle, "border");
    assert.equal(ed.photoSpacing, "tight");
    assert.equal(lux.photoSpacing, "generous");
  });

  it("Magazine is collage with no tilt identity; Scrapbook is polaroid page", () => {
    const mag = themeFor("magazine");
    const scrap = themeFor("scrapbook");
    assert.equal(mag.arrangement, "collage");
    assert.equal(mag.rotation, "none");
    assert.equal(scrap.arrangement, "scrapbook");
    assert.equal(scrap.frameStyle, "polaroid");
  });

  it("Wildflower uses alternating soft-radius rhythm without scattered tilt", () => {
    const wf = themeFor("wildflower");
    assert.equal(wf.scalePattern, "alternating");
    assert.equal(wf.rotation, "none");
    assert.equal(wf.frameStyle, "none");
    assert.ok(parseFloat(String(wf.photoRadius)) >= 0.5);
  });

  it("Midnight keeps dark cinematic grade + hero-emphasis; Film≠Modern contact sheet", () => {
    const mid = themeFor("midnight");
    const film = themeFor("film");
    const modern = themeFor("modern");
    assert.match(mid.photoFilter || "", /brightness\(\s*0\.[0-7]/);
    assert.equal(mid.scalePattern, "hero-emphasis");
    assert.equal(film.frameStyle, "border");
    assert.equal(film.photoSpacing, "tight");
    assert.equal(modern.frameStyle, "none");
    assert.equal(modern.photoSpacing, "normal");
  });

  it("all ten Phase B keys resolve without throwing", () => {
    for (const key of Object.keys(PHASE_B_PHOTO_STYLE_TOKENS) as (keyof typeof PHASE_B_PHOTO_STYLE_TOKENS)[]) {
      const tc = themeFor(key);
      assert.ok(tc.arrangement);
      assert.ok(typeof tc.photoFilter === "string");
    }
  });
});
