/**
 * Dark staff — HTC light surfaces must remap under `.dark .htc-staff` so
 * Wave F/G pastel fills do not sit under white text. Light-mode class
 * definitions stay hardcoded / light-token; only the dark remap block changes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync("app/globals.css", "utf8");

function sliceBetween(startNeedle: string, endNeedle: string) {
  const start = css.indexOf(startNeedle);
  const end = css.indexOf(endNeedle, start + 1);
  assert.ok(start >= 0, `missing start: ${startNeedle}`);
  assert.ok(end > start, `missing end after ${startNeedle}: ${endNeedle}`);
  return css.slice(start, end);
}

const lightTokens = sliceBetween(
  "Contemporary Botanical — staff Light Mode",
  "/* Soft depth on staff cards",
);

const darkRemap = sliceBetween(
  "/* CRM dark remap under staff scope",
  "DARK STAFF — HTC hardcoded light-surface companions",
);

const darkCompanions = sliceBetween(
  "DARK STAFF — HTC hardcoded light-surface companions",
  "DARK STAFF — status ink legibility",
);

describe("HTC dark surface remap — light selectors preserved", () => {
  it("light staff still declares pastel HTC surfaces and working-card white", () => {
    assert.match(lightTokens, /--htc-calm-blue:\s*#eaf1f7/);
    assert.match(lightTokens, /--htc-eucalyptus-surface:\s*#dce8e0/);
    assert.match(lightTokens, /--htc-soft-blush:\s*#f7e9eb/);
    assert.match(lightTokens, /--htc-canvas:\s*#f8f7f3/);
    assert.match(css, /\.htc-staff \.htc-working-card \{[\s\S]*?background:\s*#ffffff/);
    assert.match(css, /\.htc-staff \.htc-surface-guidance \{[\s\S]*?background:\s*var\(--htc-calm-blue\)/);
    assert.match(css, /\.htc-staff \.htc-toolbox-card \{[\s\S]*?background:\s*#ffffff/);
  });

  it("light working-card / guidance rules are not wrapped in .dark", () => {
    const working = css.indexOf(".htc-staff .htc-working-card {");
    const guidance = css.indexOf(".htc-staff .htc-surface-guidance {");
    assert.ok(working >= 0 && guidance >= 0);
    assert.doesNotMatch(css.slice(Math.max(0, working - 40), working), /\.dark/);
    assert.doesNotMatch(css.slice(Math.max(0, guidance - 40), guidance), /\.dark/);
  });
});

describe("HTC dark surface remap — dark tokens + companions", () => {
  it("dark staff remaps hospitality surface tokens away from light pastels", () => {
    assert.match(darkRemap, /\.dark \.htc-staff/);
    assert.match(darkRemap, /html\.dark:has\(\.htc-staff\)/);
    assert.match(darkRemap, /--htc-canvas:\s*var\(--background\)/);
    assert.match(darkRemap, /--htc-calm-blue:\s*color-mix/);
    assert.match(darkRemap, /--htc-eucalyptus-surface:\s*color-mix/);
    assert.match(darkRemap, /--htc-soft-blush:\s*color-mix/);
    assert.match(darkRemap, /--htc-ivory:\s*var\(--card\)/);
    assert.match(darkRemap, /--htc-border-warm:\s*var\(--border\)/);
    assert.doesNotMatch(darkRemap, /--htc-calm-blue:\s*#eaf1f7/);
    assert.doesNotMatch(darkRemap, /--htc-eucalyptus-surface:\s*#dce8e0/);
  });

  it("dark companions retarget hardcoded white utilities to var(--card)", () => {
    assert.match(darkCompanions, /\.htc-working-card/);
    assert.match(darkCompanions, /\.htc-surface-working/);
    assert.match(darkCompanions, /\.htc-toolbox-card/);
    assert.match(darkCompanions, /\.htc-merge-field-chip/);
    assert.match(darkCompanions, /background(?:-color)?:\s*var\(--card\)/);
    assert.match(darkCompanions, /\[data-slot="tabs-list"\]/);
    assert.match(darkCompanions, /\.htc-badge-active/);
    assert.match(darkCompanions, /\.htc-focus-attention-row:hover/);
  });

  it("dark companions stay scoped to dark staff only", () => {
    assert.match(darkCompanions, /\.dark \.htc-staff \.htc-working-card/);
    assert.match(darkCompanions, /html\.dark:has\(\.htc-staff\) \.htc-working-card/);
    assert.doesNotMatch(darkCompanions, /^\.htc-staff \.htc-working-card \{/m);
  });
});
