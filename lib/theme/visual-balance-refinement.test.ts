/**
 * Visual balance refinement — blush / linen / eucalyptus distribution.
 * Presentation only; does not change product behavior.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const luvSpot = readFileSync(resolve("components/luv/spot-pattern-recommendations.tsx"), "utf8");
const requiredCats = readFileSync(
  resolve("components/vendors/required-vendor-categories-panel.tsx"),
  "utf8",
);
const vendorList = readFileSync(resolve("components/vendors/vendor-list.tsx"), "utf8");
const dashboardLuv = readFileSync(resolve("components/dashboard/luv-dashboard-entry.tsx"), "utf8");
const offeringsPage = readFileSync(resolve("components/offerings/offerings-page-client.tsx"), "utf8");

describe("visual balance refinement", () => {
  it("shared Luv spot panel uses linen body + blush accent bar", () => {
    assert.match(luvSpot, /bg-\[var\(--htc-linen\)\]/);
    assert.match(luvSpot, /data-luv-accent/);
    assert.match(luvSpot, /bg-\[var\(--htc-soft-blush\)\]/);
  });

  it("Clients attention rows are white with soft-rose inset indicator", () => {
    assert.match(
      css,
      /tr\[data-attention="true"\][\s\S]*?box-shadow:\s*inset 3px 0 0 0 var\(--htc-soft-rose\)/,
    );
    assert.doesNotMatch(
      css,
      /tr\[data-attention="true"\]\s*\{\s*background:\s*var\(--htc-soft-blush\)/,
    );
  });

  it("Vendors required-categories uses calm guidance shell", () => {
    assert.match(requiredCats, /htc-surface-guidance/);
  });

  it("Vendors empty / no-match supporting states use white working card", () => {
    assert.match(vendorList, /No approved vendors yet/);
    assert.match(vendorList, /bg-card/);
  });

  it("Offerings uses one calm guidance panel", () => {
    assert.match(offeringsPage, /LibraryDependencyNote[\s\S]*tone="calm"/);
    assert.doesNotMatch(offeringsPage, /tone="blush"/);
    assert.doesNotMatch(offeringsPage, /tone="eucalyptus"/);
  });

  it("Dashboard Luv entry is white working body with blush top accent", () => {
    assert.match(dashboardLuv, /bg-card/);
    assert.match(dashboardLuv, /data-luv-accent/);
    assert.match(dashboardLuv, /htc-soft-blush/);
  });
});
