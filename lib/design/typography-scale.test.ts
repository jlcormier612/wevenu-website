import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Typography scale — Workstream A.
 *
 * The root is 17px and deliberately global: staff, couple portal, and
 * vendor all share the one <html> element (app/layout.tsx), and .htc-staff
 * is applied lower down on the shells. The staff rules are already written
 * in rem, so the 17px root is what lifts card/table body to ~16px and card
 * titles to ~18px. These assertions exist to stop the increase being
 * applied a second time on top of the root, which would overshoot.
 */
describe("staff typography scale", () => {
  const globals = readFileSync(resolve("app/globals.css"), "utf8");
  const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");

  function staffRule(slot: string): string {
    const pattern = new RegExp(
      `html:has\\(\\.htc-staff\\) \\[data-slot="${slot}"\\] \\{[^}]*\\}`,
    );
    const match = globals.match(pattern)?.[0];
    assert.ok(match, `expected a staff rule for [data-slot="${slot}"]`);
    return match;
  }

  it("sets a 17px root font size once, on html, for every experience", () => {
    const htmlRule = globals.match(/ {2}html \{[^}]*\}/)?.[0] ?? "";
    assert.match(htmlRule, /font-size:\s*17px/);
    // Not scoped to staff — the couple portal moving with the root is intended.
    assert.doesNotMatch(globals, /html:has\(\.htc-staff\)[^{]*\{[^}]*font-size:\s*17px/);
    assert.equal(globals.match(/font-size:\s*17px/g)?.length, 1);
  });

  it("keeps staff card and table body in rem so the root resolves them to ~16px", () => {
    assert.match(staffRule("card"), /font-size:\s*0\.9375rem/);
    assert.match(staffRule("table"), /font-size:\s*0\.9375rem/);
    assert.match(staffRule("card-description"), /font-size:\s*0\.9375rem/);
  });

  it("keeps staff card titles in rem so the root resolves them to ~18px", () => {
    assert.match(staffRule("card-title"), /font-size:\s*1\.0625rem/);
  });

  it("keeps badges at genuinely micro size rather than scaling them up", () => {
    assert.match(staffRule("badge"), /font-size:\s*0\.75rem/);
  });

  it("sizes sidebar items and section labels in rem-relative utilities", () => {
    assert.match(sidebar, /px-3 py-2\.5 text-base tracking-wide/);
    assert.match(sidebar, /pb-1\.5 text-xs font-medium uppercase/);
    // Pinned pixel/rem utilities here would not move with the root.
    assert.doesNotMatch(sidebar, /text-\[0\.95rem\]/);
    assert.doesNotMatch(sidebar, /text-\[0\.7rem\]/);
  });

  it("does not put staff chrome on the couple portal", () => {
    const layout = readFileSync(resolve("app/layout.tsx"), "utf8");
    assert.doesNotMatch(layout, /className=\{?["'`][^"'`]*htc-staff/);
    // Font pairing stays as-is: Inter (portal), Source Sans 3 (staff), Cormorant.
    assert.match(layout, /Source_Sans_3/);
    assert.match(layout, /Inter/);
    assert.match(layout, /Cormorant_Garamond/);
  });
});
