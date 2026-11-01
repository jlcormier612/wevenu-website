/**
 * Staff light mode: sage canvas + true-white cards; sidebar recipe unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");

describe("staff light canvas", () => {
  it("uses a Soft Sage wash for the page background, not warm beige", () => {
    const staff = css.slice(css.indexOf(".htc-staff,"), css.indexOf("/* CRM dark remap"));
    assert.match(staff, /--warm-gray:\s*color-mix\(in oklch, var\(--soft-sage\)/);
    assert.doesNotMatch(staff, /--warm-gray:\s*#f8f7f4/);
    assert.match(staff, /--background:\s*var\(--warm-gray\)/);
    assert.match(staff, /--card:\s*var\(--true-white\)/);
    assert.match(staff, /--muted:\s*var\(--true-white\)/);
    assert.match(staff, /--secondary:\s*var\(--true-white\)/);
  });

  it("leaves the sidebar taupe wash alone", () => {
    const staff = css.slice(css.indexOf(".htc-staff,"), css.indexOf("/* CRM dark remap"));
    assert.match(staff, /--sidebar:\s*color-mix\(in oklch, var\(--taupe-dark\) 40%, white\)/);
  });
});
