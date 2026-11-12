/**
 * Coming up interaction guards — whole-row link, chevron, keyboard focus classes,
 * and no nested controls that would fight navigation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const row = readFileSync(resolve("components/dashboard-system/coming-up-row.tsx"), "utf8");
const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const focus = readFileSync(resolve("components/dashboard-system/focus-attention-row.tsx"), "utf8");

describe("ComingUpRow interaction affordances", () => {
  it("uses a single semantic Link for the whole row with hospitable record styles", () => {
    assert.match(row, /data-testid="coming-up-item-link"/);
    assert.match(row, /htc-record-card-link/);
    assert.match(row, /htc-record-link/);
    assert.match(row, /ChevronRight/);
    assert.match(row, /href=\{item\.href\}/);
    assert.doesNotMatch(row, /<button/);
    assert.equal((row.match(/<Link/g) ?? []).length, 1);
  });

  it("keeps hover and focus-visible washes without urgency Focus styling", () => {
    assert.match(row, /hover:bg-muted\/40/);
    assert.match(row, /focus-visible:bg-muted\/40/);
    assert.doesNotMatch(row, /htc-focus-attention-row/);
    assert.doesNotMatch(row, /htc-soft-rose/);
    assert.doesNotMatch(row, /todays-focus-dismiss/);
  });
});

describe("Dashboard Coming up wiring", () => {
  it("renders ComingUpRow in the Coming up AttentionList", () => {
    assert.match(page, /title="Coming up"/);
    assert.match(page, /ComingUpRow/);
    assert.match(page, /htc-surface-guidance/);
    assert.doesNotMatch(page, /function ClassifiedRow/);
  });

  it("keeps Today's Focus dismiss independent of its navigation link", () => {
    assert.match(focus, /data-testid="todays-focus-item-link"/);
    assert.match(focus, /data-testid="todays-focus-dismiss"/);
    assert.match(focus, /dismissDashboardAttentionAction/);
    // Dismiss is a sibling button, not nested inside the Link.
    const linkBlock = focus.slice(focus.indexOf("<Link"), focus.indexOf("</Link>") + 7);
    assert.doesNotMatch(linkBlock, /todays-focus-dismiss/);
  });
});
