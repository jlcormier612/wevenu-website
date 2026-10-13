import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("Communication Health Back to Inbox navigation", () => {
  it("places a single ArrowLeft Back to Inbox link above the page heading", () => {
    const src = readFileSync("app/(app)/messaging/health/page.tsx", "utf8");
    const back = src.indexOf("Back to Inbox");
    const heading = src.indexOf('font-heading text-2xl font-medium text-heading">Communication Health');
    assert.ok(back >= 0, "Back to Inbox must exist");
    assert.ok(heading > back, "Back to Inbox must render above the h1");
    assert.match(src, /href="\/messaging"/);
    assert.match(src, /ArrowLeft/);
    // Exactly one occurrence — bottom duplicate removed.
    assert.equal((src.match(/Back to Inbox/g) ?? []).length, 1);
  });
});
