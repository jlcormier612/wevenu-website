import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { contrastRatio } from "@/lib/theme/public-form-surface";

const ROOT = join(__dirname, "../..");

/** Official HTC palette pairs used by vendor-selection submit controls. */
const HERITAGE_SAGE = "#5d6f5d";
const FOREST_SAGE = "#4f5f4f";
const SOFT_SAGE = "#b9d1c2";
const TRUE_WHITE = "#ffffff";
const NATURAL_CREAM = "#f7f5f1";
const BLACK = "#000000";

describe("vendor-selection button contrast", () => {
  it("shared Button outline/ghost variants set resting text-foreground (no white-on-light inherit)", () => {
    const button = readFileSync(join(ROOT, "components/ui/button.tsx"), "utf8");
    assert.match(
      button,
      /outline:\s*\n\s*"border-border bg-background text-foreground/,
    );
    assert.match(button, /ghost:\s*\n\s*"text-foreground hover:bg-muted/);
  });

  it("SubmitBar uses secondary Back + primary Submit with non-opacity disabled ink", () => {
    const vendor = readFileSync(join(ROOT, "components/portal/vendor-section.tsx"), "utf8");
    assert.match(vendor, /This submits your list to the venue and notifies the vendors you picked/);
    assert.match(vendor, /variant="secondary"/);
    assert.match(vendor, /Submit to Venue/);
    assert.match(vendor, /disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground/);
    assert.match(vendor, /disabled:opacity-100 disabled:bg-primary\/40 disabled:text-primary-foreground/);
    // Confirmation Back must not rely on outline without explicit secondary hierarchy.
    assert.doesNotMatch(
      vendor,
      /continue\?[\s\S]{0,400}variant="outline"[\s\S]{0,80}>Back/,
    );
  });

  it("vendor Pick/Select fills use primary-foreground on venue-primary (not hardcoded white)", () => {
    const vendor = readFileSync(join(ROOT, "components/portal/vendor-section.tsx"), "utf8");
    assert.match(vendor, /bg-\[var\(--venue-primary\)\] text-primary-foreground/);
    assert.doesNotMatch(vendor, /text-white hover:opacity-90/);
    assert.doesNotMatch(vendor, /style=\{isPicked \? undefined : \{ background: "var\(--venue-primary\)" \}\}/);
  });

  it("light-theme confirmation pairs meet WCAG AA (≥4.5:1)", () => {
    // Primary Submit: white on heritage sage
    assert.ok((contrastRatio(TRUE_WHITE, HERITAGE_SAGE) ?? 0) >= 4.5);
    // Secondary Back: forest sage on natural cream (secondary / secondary-foreground)
    assert.ok((contrastRatio(FOREST_SAGE, NATURAL_CREAM) ?? 0) >= 4.5);
    // Outline fallback: black/foreground on white background
    assert.ok((contrastRatio(BLACK, TRUE_WHITE) ?? 0) >= 4.5);
  });

  it("dark-theme primary-foreground token is mixed toward black for AA on soft sage", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    assert.match(
      css,
      /--primary-foreground:\s*color-mix\(in oklch,\s*var\(--forest-sage\)\s+62%,\s*black\)/,
    );
    // Pure forest-sage on soft-sage fails AA; black on soft-sage passes.
    assert.ok((contrastRatio(FOREST_SAGE, SOFT_SAGE) ?? 0) < 4.5);
    assert.ok((contrastRatio(BLACK, SOFT_SAGE) ?? 0) >= 4.5);
  });
});
