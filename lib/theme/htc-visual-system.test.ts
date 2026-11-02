/**
 * HTC visual system foundation — tokens + hospitality utilities (Clients/Offerings proof).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("HTC visual system foundation", () => {
  const css = read("app/globals.css");
  const staff = css.slice(css.indexOf(".htc-staff,"), css.indexOf("/* CRM dark remap"));
  const doc = read("docs/design/htc-visual-system.md");
  const clientsPage = read("app/(app)/clients/page.tsx");
  const clientList = read("components/clients/client-list.tsx");
  const offeringsPage = read("components/offerings/offerings-page-client.tsx");
  const offeringsSection = read("components/offerings/offerings-library-section.tsx");

  it("documents surface hierarchy and locked palette roles", () => {
    assert.match(doc, /Warm neutral page canvas/);
    assert.match(doc, /#F8F7F3/);
    assert.match(doc, /#DCE8E0/);
    assert.match(doc, /#F7E9EB/);
    assert.match(doc, /#446B56/);
    assert.match(doc, /Surface hierarchy/);
    assert.match(doc, /Expanded shade families/);
    assert.match(doc, /Explicitly rejected accents/);
  });

  it("adds canvas / eucalyptus-surface / warm-border tokens without replacing botanical primary", () => {
    assert.match(staff, /--htc-canvas:\s*#f8f7f3/i);
    assert.match(staff, /--htc-eucalyptus-surface:\s*#dce8e0/i);
    assert.match(staff, /--htc-border-warm:\s*#e6e3dc/i);
    assert.match(staff, /--primary:\s*#446b56/i);
    assert.match(staff, /--htc-soft-blush:\s*#f7e9eb/i);
    assert.match(staff, /--htc-soft-sage:\s*#c9d9ce/i);
    assert.match(staff, /--htc-green-mist:\s*#f1f5f2/i);
    assert.match(staff, /--htc-linen:\s*#f3f0e9/i);
    assert.match(staff, /--htc-ivory:\s*#faf9f5/i);
    assert.match(staff, /--htc-soft-rose:\s*#e8c5c8/i);
  });

  it("uses warm canvas on hospitality pages — not eucalyptus page fill", () => {
    assert.match(css, /\.htc-staff \.htc-hospitality-page[\s\S]*?background:\s*var\(--htc-canvas\)/);
    assert.doesNotMatch(
      css,
      /\.htc-staff \.htc-hospitality-page[\s\S]*?background:\s*color-mix\(in oklch, var\(--htc-eucalyptus\)/,
    );
  });

  it("keeps white heading + toolbar + eucalyptus table header", () => {
    assert.match(css, /\.htc-staff \.htc-hospitality-heading[\s\S]*?background:\s*var\(--card\)/);
    assert.match(css, /\.htc-staff \.htc-hospitality-toolbar/);
    assert.match(css, /background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.match(clientList, /htc-hospitality-toolbar/);
    assert.match(clientList, /htc-hospitality-table/);
    assert.match(clientsPage, /htc-hospitality-heading/);
  });

  it("structures Offerings catalog into section containers", () => {
    assert.match(offeringsSection, /groupCatalogSections/);
    assert.match(offeringsSection, /htc-catalog-section/);
    assert.match(offeringsSection, /htc-catalog-major/);
    assert.match(offeringsSection, /htc-catalog-category/);
    assert.match(offeringsSection, /data-has-children/);
    assert.match(css, /data-has-children="true"/);
    assert.match(offeringsPage, /tone="blush"/);
    assert.match(offeringsPage, /tone="eucalyptus"/);
  });

  it("parent majors use full eucalyptus surface — not a diluted OKLCH mix", () => {
    const parentRule = css.slice(
      css.indexOf('.htc-staff .htc-catalog-major[data-has-children="true"]'),
      css.indexOf(".htc-staff .htc-catalog-major[data-standalone"),
    );
    assert.match(parentRule, /background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.doesNotMatch(parentRule, /color-mix\(in oklch, var\(--htc-eucalyptus-surface\)/);
    const categoryRule = css.slice(
      css.indexOf(".htc-staff .htc-catalog-category {"),
      css.indexOf(".htc-staff .htc-catalog-item {"),
    );
    assert.match(categoryRule, /background:\s*var\(--card\)/);
    assert.match(categoryRule, /border-left:\s*3px solid var\(--htc-eucalyptus\)/);
  });

  it("remaps hospitality utilities under dark staff without warm canvas", () => {
    const dark = css.slice(css.indexOf("/* Dark Mode — hospitality"));
    assert.match(dark, /\.dark \.htc-staff \.htc-hospitality-page/);
    assert.match(dark, /background:\s*var\(--background\)/);
  });
});
