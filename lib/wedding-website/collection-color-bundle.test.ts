import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bundlesDarkColorStoryOnSelect,
  colorStoryBundlePatch,
  resolveBundledColorStory,
} from "@/lib/wedding-website/collection-color-bundle";
import type { CatalogCollection, CatalogColorStory } from "@/lib/wedding-website/types";

function story(partial: Partial<CatalogColorStory> & { key: string; name: string; id: string }): CatalogColorStory {
  return {
    sortOrder: 0,
    tokens: {
      bg: "#0a0a0a",
      accent: "#333",
      dark: true,
      colorPrimary: "#111",
      colorSecondary: "#222",
      colorAccent: "#333",
      colorNeutral: "#444",
      colorBackground: "#0a0a0a",
      colorText: "#eee",
      heroGradient: "none",
    },
    ...partial,
    tokens: {
      bg: "#0a0a0a",
      accent: "#333",
      dark: true,
      colorPrimary: "#111",
      colorSecondary: "#222",
      colorAccent: "#333",
      colorNeutral: "#444",
      colorBackground: "#0a0a0a",
      colorText: "#eee",
      heroGradient: "none",
      ...(partial.tokens ?? {}),
    },
  };
}

function collection(
  key: string,
  stories: CatalogColorStory[],
): CatalogCollection {
  return {
    id: `c-${key}`,
    key,
    name: key,
    description: null,
    isPremium: false,
    sortOrder: 0,
    swatchAccent: null,
    layoutConfig: {},
    colorStories: stories,
  };
}

describe("collection-color-bundle", () => {
  it("Midnight and Velvet rebundle Color Story on select", () => {
    assert.equal(bundlesDarkColorStoryOnSelect("modern"), true);
    assert.equal(bundlesDarkColorStoryOnSelect("velvet"), true);
    assert.equal(bundlesDarkColorStoryOnSelect("classic"), false);
  });

  it("Midnight prefers Onyx over Indigo/Black Tie", () => {
    const indigo = story({ id: "1", key: "indigo", name: "Indigo" });
    const onyx = story({ id: "2", key: "onyx", name: "Onyx" });
    const blackTie = story({ id: "3", key: "black-tie", name: "Black Tie" });
    const midnight = collection("modern", [indigo, onyx]);
    const hit = resolveBundledColorStory(midnight, [blackTie, indigo, onyx]);
    assert.equal(hit?.key, "onyx");
  });

  it("Midnight falls back to curated Black Tie when natives missing", () => {
    const blackTie = story({ id: "3", key: "black-tie", name: "Black Tie" });
    const midnight = collection("modern", []);
    const hit = resolveBundledColorStory(midnight, [blackTie]);
    assert.equal(hit?.key, "black-tie");
  });

  it("Velvet prefers Burgundy over Noir/Black Tie", () => {
    const noir = story({ id: "1", key: "noir", name: "Noir" });
    const burgundy = story({ id: "2", key: "burgundy", name: "Burgundy" });
    const blackTie = story({ id: "3", key: "black-tie", name: "Black Tie" });
    const velvet = collection("velvet", [noir, burgundy]);
    const hit = resolveBundledColorStory(velvet, [blackTie, noir, burgundy]);
    assert.equal(hit?.key, "burgundy");
  });

  it("Velvet falls back to curated Black Tie when natives missing", () => {
    const blackTie = story({ id: "3", key: "black-tie", name: "Black Tie" });
    const velvet = collection("velvet", []);
    const hit = resolveBundledColorStory(velvet, [blackTie]);
    assert.equal(hit?.key, "black-tie");
  });

  it("non-dark-bundle returns undefined (caller keeps independence)", () => {
    const wild = collection("classic", [story({ id: "s", key: "sage", name: "Sage" })]);
    assert.equal(resolveBundledColorStory(wild, []), undefined);
  });

  it("bundle patch includes six roles + ids", () => {
    const onyx = story({
      id: "2",
      key: "onyx",
      name: "Onyx",
      tokens: {
        bg: "#141414",
        accent: "#C0B8A8",
        dark: true,
        colorPrimary: "#7A6248",
        colorSecondary: "#A6957E",
        colorAccent: "#C0B8A8",
        colorNeutral: "#4A4642",
        colorBackground: "#141414",
        colorText: "#EEEAE5",
        heroGradient: "none",
      },
    });
    const patch = colorStoryBundlePatch(onyx);
    assert.equal(patch.colorStoryId, "2");
    assert.equal(patch.themePalette, "Onyx");
    assert.equal(patch.colorBackground, "#141414");
    assert.equal(patch.clearCustomColors, false);
  });
});
