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

  it("Vendors required-categories keeps eucalyptus header and linen open body", () => {
    assert.match(requiredCats, /--htc-eucalyptus-surface/);
    assert.match(requiredCats, /bg-\[var\(--htc-linen\)\]/);
  });

  it("Vendors empty / no-match supporting states use linen", () => {
    assert.match(vendorList, /No approved vendors yet[\s\S]*?htc-linen|htc-linen[\s\S]*?No approved vendors yet/);
    assert.match(vendorList, /htc-linen/);
  });

  it("Offerings retains blush + eucalyptus guidance panels", () => {
    assert.match(offeringsPage, /tone="blush"/);
    assert.match(offeringsPage, /tone="eucalyptus"/);
  });

  it("Dashboard Luv entry remains ivory + blush accent (no regression redesign)", () => {
    assert.match(dashboardLuv, /htc-ivory/);
    assert.match(dashboardLuv, /data-luv-accent/);
    assert.match(dashboardLuv, /htc-soft-blush/);
  });
});
