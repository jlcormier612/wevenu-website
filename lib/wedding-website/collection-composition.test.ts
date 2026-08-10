import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PAPER_CHAMBER } from "@/components/wedding-website/composition-primitives";
import {
  Hero,
  HERO_LEFT_TITLE_CLAMP,
  HERO_MIN_BOX_CLASS,
  resolveTheme,
  storyBodyAlignsLeft,
} from "@/components/wedding-website/wedding-website";
import { resolveCollectionPreviewTheme } from "@/lib/wedding-website/collection-preview-theme";
import { buildPreviewSite } from "@/lib/wedding-website/preview-site";
import type { CatalogCollection, CollectionLayoutConfig, PublicWebsite } from "@/lib/wedding-website/types";

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

  it("Midnight paper story role remains flush-capable (no Color-Story soft/strong canvas)", () => {
    const midnight = themeFor("modern", PHASE_B.modern);
    assert.equal(midnight.sectionRoles?.story?.canvas, "paper");
    assert.equal(midnight.sectionRoles?.story?.scale, "feature");
  });

  it("Rustic flowing-opening keeps left Collection DNA but scoped story treatment", () => {
    const rustic = themeFor("rustic", PHASE_B.rustic);
    assert.equal(rustic.itemAlign, "left");
    assert.equal(rustic.asymmetry, "subtle");
    assert.equal(rustic.sectionRoles?.story?.treatment, "flowing-opening");
    assert.equal(rustic.headerStyle, "romantic");
    assert.equal(rustic.divider, "botanical");
  });

  it("Industrial hardcode remains available but is not required in active 10 DNA map", () => {
    const industrial = themeFor("industrial");
    assert.equal(industrial.heroAlign, "left");
    assert.equal(industrial.storyStyle, "minimal");
  });
});

describe("WW-AUDIT-01 storyBodyAlignsLeft (Approach A)", () => {
  it("Rustic romantic header centers story body despite left DNA (with or without flowing-opening)", () => {
    const rustic = themeFor("rustic", PHASE_B.rustic);
    assert.equal(
      storyBodyAlignsLeft({
        headerStyle: rustic.headerStyle,
        itemAlign: rustic.itemAlign,
        heroAlign: rustic.heroAlign,
        asymmetry: rustic.asymmetry,
        storyTreatment: rustic.sectionRoles?.story?.treatment,
      }),
      false,
    );
    // Stale DB without flowing-opening still centers via header family
    assert.equal(
      storyBodyAlignsLeft({
        headerStyle: "romantic",
        itemAlign: "left",
        heroAlign: "left",
        asymmetry: "subtle",
        storyTreatment: undefined,
      }),
      false,
    );
  });

  it("Wildflower romantic header centers story body; hero offset DNA preserved on theme", () => {
    const wildflower = themeFor("classic", PHASE_B.classic);
    assert.equal(wildflower.heroAlign, "offset");
    assert.equal(wildflower.headerStyle, "romantic");
    assert.equal(
      storyBodyAlignsLeft({
        headerStyle: wildflower.headerStyle,
        itemAlign: wildflower.itemAlign,
        heroAlign: wildflower.heroAlign,
        asymmetry: wildflower.asymmetry,
        storyTreatment: wildflower.sectionRoles?.story?.treatment,
      }),
      false,
    );
  });

  it("Midnight / Coastal / Velvet editorial family stays left (magazine)", () => {
    for (const key of ["modern", "coastal", "velvet"] as const) {
      const tc = themeFor(key, PHASE_B[key]);
      assert.equal(
        storyBodyAlignsLeft({
          headerStyle: tc.headerStyle,
          itemAlign: tc.itemAlign,
          heroAlign: tc.heroAlign,
          asymmetry: tc.asymmetry,
          storyTreatment: tc.sectionRoles?.story?.treatment,
        }),
        true,
        `${key} should keep left magazine columns`,
      );
    }
  });

  it("Champagne / Estate / Garden remain centered; Rosé/Linen not left via header gate", () => {
    const champagne = themeFor("champagne", PHASE_B.champagne);
    const estate = themeFor("estate", PHASE_B.estate);
    const garden = themeFor("garden", PHASE_B.garden);
    const rose = themeFor("romance", PHASE_B.romance);
    const linen = themeFor("minimal", PHASE_B.minimal);

    for (const [name, tc] of [
      ["champagne", champagne],
      ["estate", estate],
      ["garden", garden],
      ["romance", rose],
    ] as const) {
      assert.equal(
        storyBodyAlignsLeft({
          headerStyle: tc.headerStyle,
          itemAlign: tc.itemAlign,
          heroAlign: tc.heroAlign,
          asymmetry: tc.asymmetry,
          storyTreatment: tc.sectionRoles?.story?.treatment,
        }),
        false,
        `${name} should center story body`,
      );
    }
    // Linen uses storyStyle minimal (quiet path); header family is minimal →
    // DNA fallback with centered defaults stays not-left.
    assert.equal(
      storyBodyAlignsLeft({
        headerStyle: linen.headerStyle,
        itemAlign: linen.itemAlign,
        heroAlign: linen.heroAlign,
        asymmetry: linen.asymmetry,
        storyTreatment: linen.sectionRoles?.story?.treatment,
      }),
      false,
    );
  });
});

describe("WW-AUDIT-02 inset / mobile hero clip", () => {
  function insetSite(key: "rustic" | "estate"): PublicWebsite {
    return buildPreviewSite({
      collection: collection(key, PHASE_B[key]),
      base: {
        couple: { firstName: "Emma", lastName: null, partnerFirstName: "Jordan", partnerLastName: null },
        content: {
          home: {
            title: "Emma & Jordan",
            coverImageUrl: "https://example.com/hero.jpg",
            subtitle: "Two hearts, one beautiful beginning",
          },
        },
      } as PublicWebsite,
    });
  }

  it("left-title clamp floor is below 3rem for narrow phones", () => {
    assert.match(HERO_LEFT_TITLE_CLAMP, /clamp\(2\.15rem/);
    assert.doesNotMatch(HERO_LEFT_TITLE_CLAMP, /clamp\(3rem/);
  });

  it("Rustic inset hero keeps type overflow visible and marks min-box for phone cqh", () => {
    const site = insetSite("rustic");
    const tc = resolveTheme(site);
    assert.equal(tc.heroType, "inset");
    assert.equal(tc.heroAlign, "left");

    const html = renderToStaticMarkup(React.createElement(Hero, { site, tc }));
    assert.match(html, /Emma &amp; Jordan|Emma & Jordan/);
    assert.match(html, new RegExp(HERO_MIN_BOX_CLASS));
    assert.match(html, /--ww-hero-min-height/);
    assert.match(html, /2\.15rem/);
    // Type shell must not use overflow:hidden (image is a separate layer).
    assert.match(html, /overflow:\s*visible/);
    assert.doesNotMatch(html, /overflow:\s*hidden/);
  });

  it("Estate inset hero shares the same non-clipping type shell", () => {
    const site = insetSite("estate");
    const tc = resolveTheme(site);
    assert.equal(tc.heroType, "inset");
    assert.equal(tc.heroAlign, "center");

    const html = renderToStaticMarkup(React.createElement(Hero, { site, tc }));
    assert.match(html, new RegExp(HERO_MIN_BOX_CLASS));
    assert.match(html, /overflow:\s*visible/);
    assert.doesNotMatch(html, /overflow:\s*hidden/);
  });

  it("desktop DNA min-heights remain vh-authored (art direction unchanged)", () => {
    const rustic = themeFor("rustic", PHASE_B.rustic);
    const estate = themeFor("estate", PHASE_B.estate);
    assert.equal(rustic.heroMinHeight, "58vh");
    assert.equal(estate.heroMinHeight, "68vh");
  });
});
