import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPreviewSite } from "@/lib/wedding-website/preview-site";
import type { CatalogCollection, CatalogPhotoStyle } from "@/lib/wedding-website/types";

function collection(over: Partial<CatalogCollection> & Pick<CatalogCollection, "key">): CatalogCollection {
  return {
    id: over.id ?? `id-${over.key}`,
    key: over.key,
    name: over.name ?? over.key,
    description: over.description ?? null,
    isPremium: false,
    sortOrder: 0,
    swatchAccent: null,
    layoutConfig: over.layoutConfig ?? {
      heroAlign: "center",
      storyStyle: "prose",
      animationStyle: "fade",
      galleryLayout: "grid",
    },
    colorStories: [],
  };
}

describe("buildPreviewSite", () => {
  it("sets theme from collection.key so hardcode DNA resolves per Collection", () => {
    const site = buildPreviewSite({ collection: collection({ key: "coastal" }) });
    assert.equal(site.theme, "coastal");
    assert.equal(site.layoutConfig?.galleryLayout, "grid");
  });

  it("uses Velvet / Midnight keys, not classic fallback", () => {
    assert.equal(buildPreviewSite({ collection: collection({ key: "velvet" }) }).theme, "velvet");
    assert.equal(buildPreviewSite({ collection: collection({ key: "modern" }) }).theme, "modern");
  });

  it("disableAnimation forces animationStyle none without mutating catalog row", () => {
    const catalog = collection({
      key: "classic",
      layoutConfig: { animationStyle: "rise", heroAlign: "left" },
    });
    const site = buildPreviewSite({ collection: catalog, disableAnimation: true });
    assert.equal(site.layoutConfig?.animationStyle, "none");
    assert.equal(site.layoutConfig?.heroAlign, "left");
    assert.equal(catalog.layoutConfig.animationStyle, "rise");
  });

  it("attaches photo style tokens when provided", () => {
    const photoStyle: CatalogPhotoStyle = {
      id: "ps1",
      key: "scrapbook",
      name: "Scrapbook",
      description: null,
      sortOrder: 0,
      tokens: {
        photoFilter: "saturate(1.05)",
        photoRadius: "0.25rem",
        frameStyle: "polaroid",
        captionStyle: "handwritten",
        imageScale: "normal",
        arrangement: "scrapbook",
      },
    };
    const site = buildPreviewSite({
      collection: collection({ key: "garden" }),
      photoStyle,
    });
    assert.equal(site.theme, "garden");
    assert.equal(site.photoStyleTokens?.arrangement, "scrapbook");
  });

  it("does not invent content — callers supply preview merges", () => {
    const site = buildPreviewSite({
      collection: collection({ key: "romance" }),
      content: { story: { text: "Our story" } },
    });
    assert.equal(site.content?.story?.text, "Our story");
  });
});
