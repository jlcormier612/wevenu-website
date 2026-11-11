/**
 * Invoice / payment-plan print brand ink must stay WCAG AA on Neutral and white,
 * including pale Accent-on-lavender themes (Meadowbrook-style failure).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { resolvePrintBrandInk } from "@/lib/collateral/print-brand";
import { contrastRatio } from "@/lib/theme/public-form-surface";

const ROOT = resolve(__dirname, "../..");

/** Pale cream accent on pale lavender neutral — the screenshot failure mode. */
const MEADOWBROOK_LIKE = {
  primaryColor: "#7B6B8A",
  secondaryColor: "#4A5D4A",
  accentColor: "#F5EDE0",
  neutralColor: "#E8E0F0",
};

const FANCY_LIKE = {
  primaryColor: "#5D6F5D",
  secondaryColor: "#4F5F4F",
  accentColor: "#B8AEA1",
  neutralColor: "#F7F5F1",
};

const DARK_BRAND = {
  primaryColor: "#1C1917",
  secondaryColor: "#292524",
  accentColor: "#44403C",
  neutralColor: "#FAFAF9",
};

const LIGHT_PRIMARY = {
  primaryColor: "#F5EDE0",
  secondaryColor: "#78716C",
  accentColor: "#A8A29E",
  neutralColor: "#FFFFFF",
};

describe("resolvePrintBrandInk — financial contrast", () => {
  it("replaces cream Accent on lavender Neutral with ≥4.5:1 ink", () => {
    const ink = resolvePrintBrandInk(MEADOWBROOK_LIKE);
    assert.equal(ink.neutral.toUpperCase(), MEADOWBROOK_LIKE.neutralColor.toUpperCase());
    assert.notEqual(ink.accentOnNeutral.toUpperCase(), MEADOWBROOK_LIKE.accentColor.toUpperCase());
    assert.ok((contrastRatio(ink.accentOnNeutral, ink.neutral) ?? 0) >= 4.5);
    assert.ok((contrastRatio(ink.accentOnWhite, "#FFFFFF") ?? 0) >= 4.5);
    assert.ok((contrastRatio(ink.mutedOnNeutral, ink.neutral) ?? 0) >= 4.5);
    assert.ok((contrastRatio(ink.onPrimary, ink.primary) ?? 0) >= 4.5);
  });

  it("keeps readable Accent when it already clears AA on Neutral", () => {
    const ink = resolvePrintBrandInk(FANCY_LIKE);
    assert.ok((contrastRatio(ink.accentOnNeutral, ink.neutral) ?? 0) >= 4.5);
    assert.ok((contrastRatio(ink.secondaryOnWhite, "#FFFFFF") ?? 0) >= 4.5);
  });

  it("stays readable on dark-accent and light-primary brands", () => {
    for (const brand of [DARK_BRAND, LIGHT_PRIMARY]) {
      const ink = resolvePrintBrandInk(brand);
      assert.ok((contrastRatio(ink.accentOnNeutral, ink.neutral) ?? 0) >= 4.5);
      assert.ok((contrastRatio(ink.accentOnWhite, "#FFFFFF") ?? 0) >= 4.5);
      assert.ok((contrastRatio(ink.onPrimary, ink.primary) ?? 0) >= 4.5);
    }
  });

  it("invoice print document uses contrast-safe ink helpers (not raw accent)", () => {
    const src = readFileSync(resolve(ROOT, "components/invoices/invoice-print-document.tsx"), "utf8");
    assert.match(src, /resolvePrintBrandInk/);
    assert.match(src, /invoice-print-financial-hero-amount/);
    assert.match(src, /invoice-print-totals-amount-due-now/);
    assert.doesNotMatch(src, /style=\{\{\s*color:\s*accentColor/);
  });

  it("does not change unrelated button / portal contrast modules", () => {
    const printBrand = readFileSync(resolve(ROOT, "lib/collateral/print-brand.ts"), "utf8");
    assert.doesNotMatch(printBrand, /Button|portal-shell|vendor-selection/);
  });
});
