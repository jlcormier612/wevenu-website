import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  APPROVED_CURATED_COLOR_STORIES,
  CURATED_COLOR_STORY_KEYS,
  resolveCuratedColorStories,
} from "@/lib/wedding-website/curated-color-stories";
import type { CatalogCollection, CatalogColorStory } from "@/lib/wedding-website/types";

const APPROVED_HEX: Record<string, [string, string, string, string, string, string]> = {
  "coastal-blue": ["#5F8299", "#A8BEC8", "#315B70", "#E8E1D7", "#F7F5F0", "#263A43"],
  "sage-garden": ["#BFCBB7", "#DCE2D5", "#91A287", "#EEEAE1", "#FAF8F3", "#465044"],
  "dusty-rose": ["#E8CBCD", "#F1DDDE", "#D8B3B7", "#F5E9E7", "#FFFDFC", "#6A4D50"],
  "peach-bellini": ["#F4C7B3", "#F9DCCB", "#EFAE92", "#FBE9DE", "#FFFCF8", "#704F43"],
  "lavender-haze": ["#8B74A5", "#B9A7CB", "#654D7C", "#E7DEEC", "#FBF8FC", "#3D3447"],
  "champagne-curated": ["#B8AD9F", "#D4CCC1", "#948779", "#E8E2DA", "#FCFAF7", "#4D4944"],
  "terracotta-curated": ["#B9684E", "#D79A7E", "#8D4938", "#E9D5C4", "#FBF6EF", "#4B352E"],
  "french-blue": ["#667FA5", "#A9B8D0", "#405B83", "#E2E5E8", "#FAFAF8", "#2D3748"],
  "black-tie": ["#242321", "#B7AA91", "#8A7352", "#E5DED2", "#FAF8F3", "#1E1D1B"],
  berry: ["#7A2A42", "#B85073", "#4E1A2C", "#E3C7CC", "#FBF4F3", "#341019"],
  "golden-hour": ["#C49345", "#DFC58D", "#8E672C", "#EEE1C7", "#FCF8EE", "#493D2D"],
  meadow: ["#6F8F55", "#A8B96F", "#D3AD4F", "#EEE1B8", "#FBF8EC", "#30462F"],
};

describe("Approved curated Color Stories", () => {
  it("lists exactly the 12 approved keys in order", () => {
    assert.deepEqual(CURATED_COLOR_STORY_KEYS, Object.keys(APPROVED_HEX));
    assert.equal(APPROVED_CURATED_COLOR_STORIES.length, 12);
  });

  it("stores the exact approved six-role hex values", () => {
    for (const story of APPROVED_CURATED_COLOR_STORIES) {
      const expected = APPROVED_HEX[story.key]!;
      assert.deepEqual(
        [
          story.roles.colorPrimary,
          story.roles.colorSecondary,
          story.roles.colorAccent,
          story.roles.colorNeutral,
          story.roles.colorBackground,
          story.roles.colorText,
        ],
        expected,
        story.name,
      );
    }
  });

  it("resolveCuratedColorStories returns all 12 when catalog rows exist", () => {
    const stories: CatalogColorStory[] = APPROVED_CURATED_COLOR_STORIES.map((s, i) => ({
      id: `id-${i}`,
      collectionId: "coastal",
      key: s.key,
      name: s.name,
      sortOrder: 100 + i,
      tokens: {
        ...s.roles,
        bg: s.roles.colorBackground,
        surface: "#FFFFFF",
        text: s.roles.colorText,
        textMuted: s.roles.colorPrimary,
        border: s.roles.colorNeutral,
        accent: s.roles.colorAccent,
        heroGradient: "none",
        heroOverlayColor: "#000000",
        heroOverlayOpacity: 0,
        heroTextColor: "#FFFFFF",
        dark: false,
      },
    }));
    const collections = [{
      id: "coastal",
      key: "coastal",
      name: "Coastal",
      description: "",
      isPremium: false,
      sortOrder: 0,
      swatchAccent: null,
      layoutConfig: {} as CatalogCollection["layoutConfig"],
      colorStories: stories,
    }] as CatalogCollection[];
    const resolved = resolveCuratedColorStories(collections);
    assert.equal(resolved.length, 12);
    assert.deepEqual(resolved.map((r) => r.name), [
      "Coastal Blue", "Sage Garden", "Dusty Rose", "Peach Bellini", "Lavender Haze",
      "Champagne", "Terracotta", "French Blue", "Black Tie", "Berry", "Golden Hour", "Meadow",
    ]);
  });

  it("restoration migration inserts all 12 curated keys under Coastal", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261393000000_restore_curated_color_stories.sql"),
      "utf8",
    );
    for (const key of CURATED_COLOR_STORY_KEYS) {
      assert.match(sql, new RegExp(`'${key}'`));
    }
    assert.match(sql, /where c\.key = 'coastal'/);
    assert.match(sql, /#5F8299/);
    assert.match(sql, /#FAF8F3/); // approved Black Tie background (light)
  });
});

describe("Elegant typography — Playfair italic + Lato only", () => {
  it("migration sets Playfair Display italic + Lato for elegant only", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261394000000_typography_elegant_playfair_lato.sql"),
      "utf8",
    );
    assert.match(sql, /Playfair Display/);
    assert.match(sql, /headingItalic": true/);
    assert.match(sql, /Lato/);
    assert.match(sql, /where key = 'elegant'/);
    assert.doesNotMatch(sql, /where key = 'romantic'/);
    // Tokens payload must be Playfair — not EB Garamond.
    assert.match(sql, /"headingFont": "''Playfair Display'', Georgia, serif"/);
    assert.doesNotMatch(sql, /"headingFont": "''EB Garamond''/);
  });

  it("Romantic Serif seed remains Cormorant Garamond", () => {
    const seed = readFileSync(
      join(process.cwd(), "supabase/migrations/20261009000000_hosted_experience_phase1_catalog_seed.sql"),
      "utf8",
    );
    assert.match(seed, /'romantic'/);
    assert.match(seed, /Cormorant Garamond/);
  });
});

describe("Gallery film-strip and Film contact-sheet", () => {
  it("film-strip uses scrollport-percent sizing and contained FilmStripScroller (not vw/cqw)", () => {
    const src = readFileSync(
      join(process.cwd(), "components/wedding-website/wedding-website.tsx"),
      "utf8",
    );
    assert.match(src, /galleryLayout === "film-strip"/);
    assert.match(src, /FilmStripScroller/);
    assert.match(src, /min\(\$\{w\.pct\}%, \$\{w\.max\}px\)/);
    assert.match(src, /overflow-hidden/);
    assert.doesNotMatch(src, /min\(\$\{w\.cqw\}cqw/);
    assert.doesNotMatch(src, /width: w\.vw/);
    assert.match(src, /Show more photos/);
  });

  it("Film contact-sheet runs before Collection film-strip so Coastal\\+Film is not clipped", () => {
    const src = readFileSync(
      join(process.cwd(), "components/wedding-website/wedding-website.tsx"),
      "utf8",
    );
    const contactIdx = src.indexOf("if (contactSheet)");
    const filmStripIdx = src.indexOf('if (tc.galleryLayout === "film-strip")');
    assert.ok(contactIdx > 0 && filmStripIdx > contactIdx);
  });
});
