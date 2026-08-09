import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCollectionPreviewTheme } from "@/lib/wedding-website/collection-preview-theme";
import { buildPreviewSite } from "@/lib/wedding-website/preview-site";
import { resolveTheme } from "@/components/wedding-website/wedding-website";
import type { CatalogCollection, CollectionLayoutConfig } from "@/lib/wedding-website/types";
import { PAPER_CHAMBER } from "@/components/wedding-website/composition-primitives";

function collection(
  key: string,
  layoutConfig: CollectionLayoutConfig = {},
): CatalogCollection {
  return {
    id: `id-${key}`,
    key,
    name: key,
    description: null,
    isPremium: false,
    sortOrder: 0,
    swatchAccent: null,
    layoutConfig,
    colorStories: [],
  };
}

function themeFor(key: string, layoutConfig: CollectionLayoutConfig = {}) {
  return resolveTheme(buildPreviewSite({ collection: collection(key, layoutConfig) }));
}

/** Phase B catalog recipes — mirrors migration DNA for resolveTheme tests. */
const PHASE_B: Record<string, CollectionLayoutConfig> = {
  modern: {
    heroType: "full-bleed",
    heroAlign: "left",
    heroMinHeight: "42vh",
    heroAspectCap: "2.2 / 1",
    heroMaxHeight: "58vh",
    headerStyle: "editorial",
    storyStyle: "editorial",
    sectionRoles: {
      story: { scale: "feature", canvas: "paper", treatment: "editorial-opening" },
    },
  },
  coastal: {
    heroType: "full-bleed",
    heroAlign: "center",
    heroMinHeight: "65vh",
    heroAspectCap: "2 / 1",
    heroMaxHeight: "85vh",
    headerStyle: "coastal",
    storyStyle: "prose",
    sectionRoles: {
      story: { scale: "standard", canvas: "light", treatment: "editorial-opening" },
    },
  },
  estate: {
    heroType: "inset",
    heroAlign: "center",
    heroMinHeight: "68vh",
    heroInsetPadding: "1.75rem",
    heroInsetRadius: "0.125rem",
    heroInsetBorderWidth: "1px",
    heroInsetOffsetX: "0",
    heroInsetOffsetY: "0",
    headerStyle: "formal",
    storyStyle: "prose",
    divider: "ornament",
    sectionComposition: "framed",
    sectionRoles: {
      story: { scale: "standard", canvas: "light", treatment: "formal-opening" },
    },
  },
  rustic: {
    heroType: "inset",
    heroAlign: "left",
    heroMinHeight: "58vh",
    heroInsetPadding: "0.85rem 0.85rem 1.45rem 0.85rem",
    heroInsetRadius: "0.4rem",
    heroInsetBorderWidth: "0px",
    heroInsetOffsetX: "-0.65rem",
    heroInsetOffsetY: "0.45rem",
    headerStyle: "romantic",
    storyStyle: "prose",
    divider: "botanical",
    itemAlign: "left",
    asymmetry: "subtle",
    sectionRoles: {
      story: { scale: "standard", canvas: "light", treatment: "flowing-opening" },
    },
  },
  champagne: {
    heroType: "full-bleed",
    heroAlign: "center",
    heroMinHeight: "68vh",
    headerStyle: "formal",
    storyStyle: "prose",
    divider: "deco",
    sectionComposition: "framed",
    sectionFrame: "card",
    sectionRoles: {
      story: { scale: "standard", canvas: "light", treatment: "formal-framed" },
    },
  },
  classic: {
    heroType: "full-bleed",
    heroAlign: "offset",
    heroMinHeight: "65vh",
    headerStyle: "romantic",
    storyStyle: "prose",
    divider: "botanical",
    itemAlign: "left",
    asymmetry: "editorial",
    sectionRoles: {
      story: { scale: "standard", canvas: "light", treatment: "romantic-opening" },
    },
  },
  garden: {
    heroType: "full-bleed",
    heroAlign: "center",
    heroMinHeight: "72vh",
    headerStyle: "romantic",
    storyStyle: "prose",
    divider: "dots",
    density: "airy",
    asymmetry: "none",
    itemAlign: "center",
    sectionRoles: {
      story: { scale: "standard", canvas: "light", treatment: "conversational-opening" },
    },
  },
  // Untouched baselines
  minimal: {
    heroType: "invitation",
    heroAlign: "center",
    headerStyle: "minimal",
    storyStyle: "minimal",
  },
  romance: {
    heroType: "full-bleed",
    heroAlign: "center",
    headerStyle: "romantic",
    storyStyle: "quote",
    divider: "ornament",
  },
  velvet: {
    heroType: "full-bleed",
    heroAlign: "left",
    heroMinHeight: "80vh",
    headerStyle: "editorial",
    storyStyle: "editorial",
    sectionRoles: {
      story: { scale: "standard", canvas: "light", treatment: "editorial-opening" },
    },
  },
};

describe("resolveCollectionPreviewTheme", () => {
  it("preserves heroAspectCap for Coastal / cinematic Collections", () => {
    const preview = resolveCollectionPreviewTheme(
      { heroType: "full-bleed", heroAspectCap: "2 / 1", heroMinHeight: "65vh", heroMaxHeight: "85vh" },
      "200px",
    );
    assert.equal(preview.heroAspectCap, "2 / 1");
    assert.equal(preview.heroMaxHeight, "200px");
    assert.equal(preview.heroMinHeight, undefined);
  });

  it("does not invent aspect-cap clearing for ordinary full-bleed", () => {
    const preview = resolveCollectionPreviewTheme(
      { heroType: "full-bleed", heroMinHeight: "65vh" },
      "180px",
    );
    assert.equal(preview.heroMinHeight, "180px");
    assert.equal(preview.heroMaxHeight, "180px");
    assert.equal(preview.heroAspectCap, undefined);
  });

  it("keeps invitation suite DNA (no flat clamp that erases paper)", () => {
    const preview = resolveCollectionPreviewTheme(
      { heroType: "invitation", heroMinHeight: "auto" },
      "160px",
    );
    assert.equal(preview.heroType, "invitation");
    assert.equal(preview.heroMinHeight, "160px");
    assert.equal(preview.heroMaxHeight, undefined);
    assert.equal(preview.heroAspectCap, undefined);
  });

  it("keeps inset framing params while pinning card height", () => {
    const preview = resolveCollectionPreviewTheme(
      {
        heroType: "inset",
        heroMinHeight: "68vh",
        heroInsetPadding: "1.75rem",
        heroInsetOffsetX: "0",
      },
      "190px",
    );
    assert.equal(preview.heroType, "inset");
    assert.equal(preview.heroInsetPadding, "1.75rem");
    assert.equal(preview.heroMinHeight, "190px");
    assert.equal(preview.heroMaxHeight, "190px");
  });
});

describe("Phase B Collection composition DNA", () => {
  it("Midnight is wide cinematic + paper story chamber vs Velvet tall dark editorial", () => {
    const midnight = themeFor("modern", PHASE_B.modern);
    const velvet = themeFor("velvet", PHASE_B.velvet);
    assert.equal(midnight.heroAlign, "left");
    assert.ok(midnight.heroAspectCap);
    assert.equal(midnight.sectionRoles?.story?.canvas, "paper");
    assert.equal(midnight.sectionRoles?.story?.treatment, "editorial-opening");
    assert.equal(velvet.heroAlign, "left");
    assert.equal(velvet.heroAspectCap, undefined);
    assert.notEqual(velvet.sectionRoles?.story?.canvas, "paper");
    // Structural distinguishers (geometry + chamber), not color
    assert.notEqual(midnight.heroAspectCap ?? null, velvet.heroAspectCap ?? null);
    assert.notEqual(midnight.sectionRoles?.story?.canvas, velvet.sectionRoles?.story?.canvas);
  });

  it("Coastal keeps wide aspect-cap through resolveTheme", () => {
    const coastal = themeFor("coastal", PHASE_B.coastal);
    assert.equal(coastal.heroAspectCap, "2 / 1");
    assert.equal(coastal.sectionRoles?.story?.treatment, "editorial-opening");
    const preview = resolveCollectionPreviewTheme(coastal, "210px");
    assert.equal(preview.heroAspectCap, "2 / 1");
  });

  it("Estate and Rustic share inset heroType with different parameters", () => {
    const estate = themeFor("estate", PHASE_B.estate);
    const rustic = themeFor("rustic", PHASE_B.rustic);
    assert.equal(estate.heroType, "inset");
    assert.equal(rustic.heroType, "inset");
    assert.notEqual(estate.heroInsetPadding, rustic.heroInsetPadding);
    assert.notEqual(estate.heroInsetOffsetX, rustic.heroInsetOffsetX);
    assert.equal(estate.heroAlign, "center");
    assert.equal(rustic.heroAlign, "left");
    assert.notEqual(estate.sectionRoles?.story?.treatment, "editorial-opening");
    assert.notEqual(rustic.sectionRoles?.story?.treatment, "editorial-opening");
  });

  it("Champagne keeps formal framed identity without EditorialOpening", () => {
    const champagne = themeFor("champagne", PHASE_B.champagne);
    assert.equal(champagne.headerStyle, "formal");
    assert.equal(champagne.divider, "deco");
    assert.equal(champagne.sectionComposition, "framed");
    assert.equal(champagne.heroType, "full-bleed");
    assert.notEqual(champagne.sectionRoles?.story?.treatment, "editorial-opening");
  });

  it("Wildflower offset/asymmetric ≠ Garden Party center/airy", () => {
    const wildflower = themeFor("classic", PHASE_B.classic);
    const garden = themeFor("garden", PHASE_B.garden);
    assert.equal(wildflower.heroAlign, "offset");
    assert.equal(garden.heroAlign, "center");
    assert.equal(wildflower.asymmetry, "editorial");
    assert.equal(garden.asymmetry, "none");
    assert.equal(garden.density, "airy");
    assert.notEqual(wildflower.heroAlign, garden.heroAlign);
  });

  it("Linen invitation and Rosé quote paths remain unchanged", () => {
    const linen = themeFor("minimal", PHASE_B.minimal);
    const rose = themeFor("romance", PHASE_B.romance);
    assert.equal(linen.heroType, "invitation");
    assert.equal(linen.storyStyle, "minimal");
    assert.equal(rose.storyStyle, "quote");
    assert.equal(rose.divider, "ornament");
    assert.equal(rose.heroAlign, "center");
  });

  it("paper chamber token is an independent light field (not Color-Story-derived)", () => {
    assert.ok(PAPER_CHAMBER.bg);
    assert.match(PAPER_CHAMBER.bg, /^#/);
    assert.notEqual(PAPER_CHAMBER.text.toLowerCase(), "#ede8e2");
  });

  it("Industrial hardcode remains available but is not required in active 10 DNA map", () => {
    const industrial = themeFor("industrial");
    assert.equal(industrial.heroAlign, "left");
    assert.equal(industrial.storyStyle, "minimal");
  });
});
