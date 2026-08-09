/**
 * Photo Style Composition Phase B — resolveTheme token DNA + silhouette gates.
 * Mirrors migration 20261237000000 (no live DB required).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTheme } from "@/components/wedding-website/wedding-website";
import { buildPreviewSite } from "@/lib/wedding-website/preview-site";
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

/** Phase B catalog recipes — mirrors migration DNA. */
const PHASE_B: Record<string, CatalogPhotoStyle["tokens"]> = {
  editorial: {
    shadow: "none", spacing: "tight", rotation: "none", frameStyle: "none",
    imageScale: "large", arrangement: "uniform",
    photoFilter: "contrast(1.08) saturate(1.02)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "hero-emphasis",
  },
  magazine: {
    shadow: "soft", spacing: "tight", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "collage",
    photoFilter: "contrast(1.06) saturate(1.02)",
    photoRadius: "0.15rem", captionStyle: "minimal", scalePattern: "uniform",
  },
  film: {
    shadow: "none", spacing: "tight", rotation: "none", frameStyle: "border",
    imageScale: "normal", arrangement: "uniform",
    photoFilter: "sepia(0.28) saturate(0.78) contrast(0.92) brightness(1.05)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "uniform",
  },
  minimal: {
    shadow: "none", spacing: "generous", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "sparse",
    photoFilter: "saturate(0.88) brightness(1.04)",
    photoRadius: "0", captionStyle: "none", scalePattern: "uniform",
  },
  modern: {
    shadow: "none", spacing: "normal", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "uniform",
    photoFilter: "none",
    photoRadius: "0", captionStyle: "none", scalePattern: "uniform",
  },
  luxury: {
    shadow: "soft", spacing: "generous", rotation: "none", frameStyle: "border",
    imageScale: "large", arrangement: "uniform",
    photoFilter: "contrast(1.02) saturate(0.94) brightness(1.02)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "hero-emphasis",
  },
  scrapbook: {
    shadow: "soft", spacing: "normal", rotation: "subtle", frameStyle: "polaroid",
    imageScale: "normal", arrangement: "scrapbook",
    photoFilter: "saturate(1.08) brightness(1.04) contrast(0.98)",
    photoRadius: "0.25rem", captionStyle: "handwritten", scalePattern: "uniform",
  },
  wildflower: {
    shadow: "soft", spacing: "normal", rotation: "none", frameStyle: "none",
    imageScale: "normal", arrangement: "uniform",
    photoFilter: "saturate(1.1) contrast(0.95) brightness(1.03) sepia(0.06)",
    photoRadius: "0.85rem", captionStyle: "none", scalePattern: "alternating",
  },
  midnight: {
    shadow: "none", spacing: "tight", rotation: "none", frameStyle: "none",
    imageScale: "large", arrangement: "uniform",
    photoFilter: "brightness(0.68) contrast(1.32) saturate(0.65)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "hero-emphasis",
  },
  gallery_wall: {
    shadow: "lifted", spacing: "normal", rotation: "none", frameStyle: "border",
    imageScale: "normal", arrangement: "gallery-wall",
    photoFilter: "contrast(1.04) saturate(0.96)",
    photoRadius: "0", captionStyle: "minimal", scalePattern: "uniform",
  },
};

function themeFor(key: keyof typeof PHASE_B) {
  return resolveTheme(
    buildPreviewSite({
      collection: collection("classic"),
      photoStyle: photoStyle(key, PHASE_B[key]!),
    }),
  );
}

describe("Photo Style Phase B resolveTheme DNA", () => {
  it("Minimal is sparse rectangular, not circular", () => {
    const tc = themeFor("minimal");
    assert.equal(tc.arrangement, "sparse");
    assert.notEqual(tc.photoRadius, "50%");
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
    for (const key of Object.keys(PHASE_B) as (keyof typeof PHASE_B)[]) {
      const tc = themeFor(key);
      assert.ok(tc.arrangement);
      assert.ok(typeof tc.photoFilter === "string");
    }
  });
});
