/**
 * Venue brand surface — pale brand colors must not wash out customer text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { contrastRatio } from "@/lib/theme/public-form-surface";
import {
  normalizeBrandHex,
  resolveVenueBrandSurface,
} from "@/lib/theme/venue-brand-surface";

const ROOT = resolve(__dirname, "../..");

const PALE_FAILURE = {
  primaryColor: "#F4C2C2",
  secondaryColor: "#E8B4B8",
  accentColor: "#D8A7AA",
  neutralColor: "#FDF8F8",
};

const DARK = {
  primaryColor: "#1C1917",
  secondaryColor: "#292524",
  accentColor: "#44403C",
  neutralColor: "#FAFAF9",
};

const SATURATED = {
  primaryColor: "#FF1493",
  secondaryColor: "#00BFFF",
  accentColor: "#FF00FF",
  neutralColor: "#FFF0F5",
};

describe("resolveVenueBrandSurface contrast", () => {
  it("replaces pale secondary/accent on a pale neutral so body text clears 4.5:1", () => {
    const resolved = resolveVenueBrandSurface(PALE_FAILURE);
    assert.equal(resolved.surface, "#FDF8F8");
    assert.ok(resolved.adjustedText);
    assert.ok(resolved.adjustedEmphasis);
    assert.ok((contrastRatio(resolved.text, resolved.surface) ?? 0) >= 4.5);
    assert.ok((contrastRatio(resolved.textMuted, resolved.surface) ?? 0) >= 4.5);
    assert.ok((contrastRatio(resolved.textEmphasis, resolved.surface) ?? 0) >= 4.5);
    assert.notEqual(resolved.text.toUpperCase(), PALE_FAILURE.secondaryColor.toUpperCase());
  });

  it("keeps readable dark secondary on a light surface", () => {
    const resolved = resolveVenueBrandSurface(DARK);
    assert.equal(resolved.adjustedText, false);
    assert.equal(resolved.text.toUpperCase(), DARK.secondaryColor.toUpperCase());
    assert.ok((contrastRatio(resolved.text, resolved.surface) ?? 0) >= 4.5);
  });

  it("picks readable ink on primary-filled controls for light and dark brands", () => {
    const pale = resolveVenueBrandSurface(PALE_FAILURE);
    const dark = resolveVenueBrandSurface({
      ...DARK,
      primaryColor: "#111111",
      neutralColor: "#111111",
    });
    assert.ok((contrastRatio(pale.onPrimary, pale.primary) ?? 0) >= 4.5);
    assert.ok((contrastRatio(dark.onPrimary, dark.primary) ?? 0) >= 4.5);
  });

  it("handles white, near-white, black, and invalid brand values", () => {
    const white = resolveVenueBrandSurface({
      primaryColor: "#FFFFFF",
      secondaryColor: "#FFFFFF",
      accentColor: "#FAFAFA",
      neutralColor: "#FFFFFF",
    });
    assert.ok((contrastRatio(white.text, white.surface) ?? 0) >= 4.5);
    const black = resolveVenueBrandSurface({
      primaryColor: "#000000",
      secondaryColor: "#111111",
      accentColor: "#0A0A0A",
      neutralColor: "#000000",
    });
    assert.ok((contrastRatio(black.text, black.surface) ?? 0) >= 4.5);
    const invalid = resolveVenueBrandSurface({
      primaryColor: "not-a-color",
      secondaryColor: "",
      accentColor: null,
      neutralColor: undefined,
    });
    assert.equal(invalid.primary, "#5D6F5D");
    assert.equal(invalid.surface, "#F7F5F1");
  });

  it("exposes semantic CSS variables for customer-facing renderers", () => {
    const resolved = resolveVenueBrandSurface(SATURATED);
    const style = resolved.style as Record<string, string>;
    assert.equal(style.backgroundColor, SATURATED.neutralColor.toUpperCase());
    assert.equal(style["--venue-primary"], SATURATED.primaryColor.toUpperCase());
    assert.equal(style["--venue-secondary"], resolved.text);
    assert.equal(style["--venue-accent"], resolved.textEmphasis);
    assert.equal(style["--muted-foreground"], resolved.textMuted);
    assert.equal(style["--primary-foreground"], resolved.onPrimary);
    assert.equal(style["--venue-card"], resolved.card);
  });

  it("normalizes 3-digit hex", () => {
    assert.equal(normalizeBrandHex("#abc", "#000000"), "#AABBCC");
  });
});

describe("proposal and shared surfaces use the contrast resolver", () => {
  it("multi-option proposal, single proposal, brochure, and contract call venueBrandSurfaceStyle", () => {
    for (const rel of [
      "components/booking-journey/multi-option-proposal-view.tsx",
      "components/booking-journey/proposal-artifact.tsx",
      "components/brochures/brochure-preview-view.tsx",
      "components/contracts/contract-signing-artifact.tsx",
    ]) {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      assert.match(src, /venueBrandSurfaceStyle/, rel);
      assert.match(src, /data-theme-lock="light"/, rel);
      assert.doesNotMatch(src, /bg-white\/40/);
    }
  });

  it("setup brand step explains automatic readability without requiring contrast knowledge", () => {
    const setup = readFileSync(resolve(ROOT, "components/setup/setup-steps.tsx"), "utf8");
    assert.match(setup, /automatically keeps text readable/);
    assert.match(setup, /inkOn\(primary\)/);
  });
});
