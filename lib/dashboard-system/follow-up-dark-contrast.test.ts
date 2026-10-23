/**
 * Dashboard "Follow up" action dark-mode contrast.
 * Uses semantic --warning-foreground (FocusAttentionRow / ClassifiedRow).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const row = readFileSync(
  resolve("components/dashboard-system/focus-attention-row.tsx"),
  "utf8",
);
const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");

describe("dashboard Follow up dark-mode contrast", () => {
  it("dark theme warning-foreground is light text, not forest-sage", () => {
    const darkBlock = css.slice(css.indexOf(".dark {"), css.indexOf(".dark {") + 2200);
    assert.match(darkBlock, /--warning-foreground:\s*var\(--true-white\)/);
    assert.doesNotMatch(
      darkBlock,
      /--warning-foreground:\s*var\(--forest-sage\)/,
    );
  });

  it("light theme warning-foreground stays forest-sage", () => {
    const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
    assert.match(rootBlock, /--warning-foreground:\s*var\(--forest-sage\)/);
  });

  it("FocusAttentionRow and ClassifiedRow still use warning-foreground for warning severity", () => {
    assert.match(
      row,
      /severity === "warning" \? "text-warning-foreground"/,
    );
    assert.match(
      page,
      /severity === "warning" \? "text-warning-foreground"/,
    );
    assert.match(row, /rightLabel/);
    assert.match(
      readFileSync(resolve("lib/dashboard-system/decision-engine.ts"), "utf8"),
      /rightLabel: "Follow up"/,
    );
  });
});
