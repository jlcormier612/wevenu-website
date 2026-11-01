/**
 * Staff light mode — Modern Botanical Luxury tokens (palette-exact mixes).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const staff = css.slice(css.indexOf(".htc-staff,"), css.indexOf("/* CRM dark remap"));

describe("staff light canvas — Modern Botanical Luxury", () => {
  it("uses True White workspace, not a uniform sage page wash", () => {
    assert.match(staff, /--background:\s*var\(--true-white\)/);
    assert.match(staff, /--card:\s*var\(--true-white\)/);
    assert.doesNotMatch(staff, /--background:\s*var\(--warm-gray\)/);
    assert.doesNotMatch(staff, /--warm-gray:\s*color-mix\(in oklch, var\(--soft-sage\)/);
  });

  it("uses Soft Sage only for supporting/selected surfaces", () => {
    assert.match(staff, /--panel-sage:\s*color-mix\(in oklch, var\(--soft-sage\)/);
    assert.match(staff, /--muted:\s*var\(--panel-sage\)/);
    assert.match(staff, /--selected:\s*color-mix\(in oklch, var\(--soft-sage\)/);
  });

  it("separates the sidebar with a pale Dusty Rose wash", () => {
    assert.match(staff, /--sidebar:\s*color-mix\(in oklch, var\(--dusty-rose\)/);
    assert.match(staff, /--sidebar-accent:\s*color-mix\(in oklch, var\(--heritage-sage\)/);
  });

  it("does not rewrite the dark staff remap block", () => {
    const dark = css.slice(css.indexOf("/* CRM dark remap"));
    assert.match(dark, /\.dark \.htc-staff/);
    assert.match(dark, /--background:\s*var\(--forest-sage\)/);
    assert.match(dark, /--card:\s*var\(--heritage-sage\)/);
  });
});
