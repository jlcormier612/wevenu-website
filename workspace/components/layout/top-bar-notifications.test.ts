import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

describe("Stage 1E Business Dashboard notifications presentation", () => {
  it("keeps alerts in a compact menu instead of a horizontal text strip", () => {
    const src = readFileSync(
      path.join(__dirname, "top-bar.tsx"),
      "utf8",
    );
    assert.match(src, /data-testid="notifications-menu-button"/);
    assert.match(src, /data-testid="notifications-menu"/);
    assert.match(src, /truncate/);
    assert.match(src, /Open Today for full activity/);
    assert.doesNotMatch(
      src,
      /hidden min-w-0 text-right lg:block[\s\S]*unread\.map/,
    );
  });
});
