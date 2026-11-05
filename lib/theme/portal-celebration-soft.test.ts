/**
 * Couple portal — Celebration Soft palette B (ivory canvas + blush accents).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("portal Celebration Soft palette B", () => {
  it("pins ivory canvas + botanical primary + blush tokens on the portal layout", () => {
    const layout = read("app/(portal)/layout.tsx");
    assert.match(layout, /htc-portal/);
    assert.match(layout, /data-portal-palette="celebration-soft-b"/);
    assert.match(layout, /#faf9f5/);
    assert.match(layout, /#446b56/);
    assert.match(layout, /#d99a9e/);
    assert.match(layout, /#e6e3dc/);
    assert.match(layout, /#ffffff/);
    assert.doesNotMatch(layout, /--background":\s*"var\(--true-white\)"/);
    assert.doesNotMatch(layout, /heritage-sage|forest-sage/);
  });

  it("keeps portal overflow clipped for PortalShell", () => {
    const layout = read("app/(portal)/layout.tsx");
    assert.match(layout, /h-svh overflow-hidden/);
  });

  it("scopes celebration blush utility under .htc-portal without inventing colors", () => {
    const css = read("app/globals.css");
    assert.match(css, /\.htc-portal\s*\{/);
    assert.match(css, /\.htc-portal \[data-portal-celebration\]/);
    assert.match(css, /--htc-ivory:\s*#faf9f5/i);
    assert.match(css, /--htc-soft-blush:\s*#f7e9eb/i);
  });

  it("uses HTC blush HEX for portal celebration accents (alpha-safe)", () => {
    const shell = read("components/portal/portal-shell.tsx");
    assert.match(shell, /const ROSE = "#d99a9e"/);
    assert.match(shell, /data-portal-celebration/);
    assert.match(shell, /htc-ivory/);
  });
});
