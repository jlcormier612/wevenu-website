/**
 * Regression acceptance for Production Marketing Mobile Layout Corrections.
 * Static CSS contracts — proves the root-cause rules stay fixed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const productCss = readFileSync(
  resolve("marketing/app/product-opening.css"),
  "utf8",
);
const featuresCss = readFileSync(
  resolve("marketing/app/features-showroom.css"),
  "utf8",
);

function mobileBlock(css: string): string {
  const match = css.match(
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\n\}(?=\s*(?:@media|\/\*|$))/,
  );
  assert.ok(match, "expected a max-width: 640px media block");
  return match[0];
}

describe("Product hero mobile mockup composition", () => {
  it("keeps absolute overlapping phone (not relative stack) on mobile", () => {
    const mobile = mobileBlock(productCss);
    assert.match(mobile, /\.po-phone-frame\s*\{[^}]*position:\s*absolute/s);
    assert.doesNotMatch(
      mobile,
      /\.po-phone-frame\s*\{[^}]*position:\s*relative/s,
    );
    assert.doesNotMatch(mobile, /width:\s*min\(\s*64%\s*,\s*240px\s*\)/);
  });

  it("sizes phone as a foreground accent and desktop as full-width primary", () => {
    const mobile = mobileBlock(productCss);
    assert.match(mobile, /\.po-desktop-frame\s*\{[^}]*width:\s*100%/s);
    assert.match(
      mobile,
      /\.po-phone-frame\s*\{[^}]*width:\s*clamp\(\s*92px\s*,\s*30vw\s*,\s*118px\s*\)/s,
    );
  });
});

describe("Features showroom mobile overflow constraints", () => {
  it("constrains layout/stage grid tracks with minmax(0, 1fr)", () => {
    assert.match(
      featuresCss,
      /\.htc-showroom\s+\.fs-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    assert.match(
      featuresCss,
      /\.htc-showroom\s+\.fs-stage\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    );
    assert.match(
      featuresCss,
      /\.htc-showroom\s+\.fs-stage\s*>\s*\*\s*\{[^}]*min-width:\s*0/s,
    );
  });

  it("forces headlines and explanations to wrap within the shell", () => {
    assert.match(
      featuresCss,
      /\.htc-showroom\s+\.fs-headline\s*\{[^}]*overflow-wrap:\s*break-word/s,
    );
    assert.match(
      featuresCss,
      /\.htc-showroom\s+\.fs-explanation\s*\{[^}]*max-width:\s*min\(54ch,\s*100%\)/s,
    );
  });

  it("does not rely on page-level overflow-x hidden as the fix", () => {
    assert.doesNotMatch(
      featuresCss,
      /html\s*,\s*body\s*\{[^}]*overflow-x:\s*hidden/s,
    );
    assert.doesNotMatch(
      featuresCss,
      /\.htc-showroom\s*\{[^}]*overflow-x:\s*hidden/s,
    );
  });
});
