/**
 * Shared design-system contrast regression gate.
 * Fails when button/badge/token pairs drop below WCAG 2.2 AA for normal text (4.5:1).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { contrastRatio } from "@/lib/theme/public-form-surface";

const ROOT = join(__dirname, "../..");

const BLACK = "#000000";
const WHITE = "#ffffff";
const DUSTY_ROSE = "#d8a7aa";
const HERITAGE_SAGE = "#5d6f5d";
const FOREST_SAGE = "#4f5f4f";
const SOFT_SAGE = "#b9d1c2";
const AMBER_50 = "#fffbeb";
const NATURAL_CREAM = "#f7f5f1";

function mixOntoWhite(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mr = Math.round(255 * (1 - opacity) + r * opacity);
  const mg = Math.round(255 * (1 - opacity) + g * opacity);
  const mb = Math.round(255 * (1 - opacity) + b * opacity);
  return `#${[mr, mg, mb].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function assertAA(fg: string, bg: string, label: string) {
  const ratio = contrastRatio(fg, bg) ?? 0;
  assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1 (need ≥4.5)`);
}

describe("shared contrast regression — palette pairs", () => {
  it("destructive button: black ink on solid dusty-rose meets AA", () => {
    assertAA(BLACK, DUSTY_ROSE, "destructive button");
  });

  it("destructive soft badge: black on dusty/25 over white meets AA", () => {
    assertAA(BLACK, mixOntoWhite(DUSTY_ROSE, 0.25), "destructive badge soft");
  });

  it("pale dusty-rose as text on white fails AA (banned pattern)", () => {
    const ratio = contrastRatio(DUSTY_ROSE, WHITE) ?? 0;
    assert.ok(ratio < 4.5, "dusty-as-text must remain a known fail so badge stays fixed");
  });

  it("outline/dismiss on amber-50: black on white-ish surface meets AA; white fails", () => {
    assertAA(BLACK, AMBER_50, "banner ink light");
    assert.ok((contrastRatio(WHITE, AMBER_50) ?? 0) < 4.5);
  });

  it("primary / secondary resting pairs used by shared Button", () => {
    assertAA(WHITE, HERITAGE_SAGE, "primary light");
    assertAA(FOREST_SAGE, NATURAL_CREAM, "secondary light");
    assertAA(BLACK, SOFT_SAGE, "dark primary-foreground target on soft sage");
  });

  it("forest-sage on dusty-rose fails AA (old destructive-foreground)", () => {
    assert.ok((contrastRatio(FOREST_SAGE, DUSTY_ROSE) ?? 0) < 4.5);
  });
});

describe("shared contrast regression — source contracts", () => {
  it("Button destructive uses solid bg-destructive + text-destructive-foreground", () => {
    const button = readFileSync(join(ROOT, "components/ui/button.tsx"), "utf8");
    assert.match(button, /bg-destructive text-destructive-foreground/);
    assert.doesNotMatch(button, /bg-destructive\/15 text-foreground/);
  });

  it("Badge destructive does not use pale text-destructive on soft fill", () => {
    const badge = readFileSync(join(ROOT, "components/ui/badge.tsx"), "utf8");
    assert.match(badge, /destructive:\s*"bg-destructive\/25 text-destructive-foreground"/);
    assert.doesNotMatch(badge, /destructive:\s*"bg-destructive\/15 text-destructive"/);
    assert.match(badge, /default:\s*"bg-primary\/15 text-foreground"/);
  });

  it("globals pin destructive-foreground to black in light and dark", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    const light = css.slice(0, css.indexOf(".dark {"));
    const dark = css.slice(css.indexOf(".dark {"));
    assert.match(light, /--destructive-foreground:\s*var\(--black\)/);
    assert.match(dark, /--destructive-foreground:\s*var\(--black\)/);
    assert.doesNotMatch(
      light.slice(light.indexOf("--destructive:")),
      /--destructive-foreground:\s*var\(--forest-sage\)/,
    );
  });

  it("assignment withdrawal banner is theme-aware and pins readable button ink", () => {
    const section = readFileSync(
      join(ROOT, "components/events/vendors/event-vendors-section.tsx"),
      "utf8",
    );
    assert.match(section, /data-testid="vendor-removal-request-banner"/);
    assert.match(section, /dark:bg-amber-950\/40/);
    assert.match(section, /bg-background text-foreground/);
    assert.match(section, /Remove \(override required\)/);
    assert.match(section, /Dismiss request — keep vendor assigned/);
  });
});
