/**
 * Staff light mode — Contemporary Botanical (Stage 2B designer-directed).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const staff = css.slice(css.indexOf(".htc-staff,"), css.indexOf("/* CRM dark remap"));
const nav = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");

describe("staff light canvas — Contemporary Botanical Stage 2B", () => {
  it("implements the designer-specified HEX roles", () => {
    assert.match(staff, /--primary:\s*#446b56/i);
    assert.match(staff, /--accent:\s*#a7c2af/i);
    assert.match(staff, /--destructive:\s*#d99a9e/i);
    assert.match(staff, /--panel-blush:\s*#f7e9eb/i);
    assert.match(staff, /--card:\s*#ffffff/i);
    assert.match(staff, /--background:\s*#f8f7f3/i);
    assert.match(staff, /--htc-workspace:\s*#f8f7f3/i);
    assert.match(staff, /--htc-canvas:\s*#f8f7f3/i);
    assert.match(staff, /--foreground:\s*#24332b/i);
    assert.match(staff, /--muted-foreground:\s*#5f6f68/i);
    assert.match(staff, /--border:\s*#e6e3dc/i);
  });

  it("uses a pure white sidebar — never blush or pale-green chrome", () => {
    assert.match(staff, /--sidebar:\s*#ffffff/i);
    assert.doesNotMatch(staff, /--sidebar:\s*color-mix\(in oklch, var\(--dusty-rose\)/);
    assert.doesNotMatch(staff, /--sidebar:\s*#f7e9eb/i);
  });

  it("keeps dark ink on refined blush (never white-on-blush)", () => {
    assert.match(staff, /--destructive-foreground:\s*#24332b/i);
  });

  it("marks active nav with botanical indicator + eucalyptus wash + dark label", () => {
    assert.match(nav, /before:bg-sidebar-primary/);
    assert.match(nav, /bg-sidebar-accent font-medium text-sidebar-foreground/);
    assert.doesNotMatch(nav, /isActive[\s\S]*\?[\s\S]*text-sidebar-primary/);
    assert.match(staff, /--sidebar-accent:\s*color-mix\(in oklch, #a7c2af/);
    assert.match(staff, /--sidebar-accent-foreground:\s*#24332b/i);
  });

  it("does not rewrite the dark staff remap block", () => {
    const dark = css.slice(css.indexOf("/* CRM dark remap"));
    assert.match(dark, /\.dark \.htc-staff/);
    assert.match(dark, /--background:\s*var\(--forest-sage\)/);
    assert.match(dark, /--card:\s*var\(--heritage-sage\)/);
  });
});
