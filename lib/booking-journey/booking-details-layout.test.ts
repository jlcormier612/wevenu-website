/**
 * Booking Details package row must not collapse facts into a narrow column
 * when tax/discount locked helper copy is present.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const facts = readFileSync(resolve("components/booking-journey/commercial-facts.tsx"), "utf8");

describe("Booking Details package row layout", () => {
  it("gives package facts flex-1 and keeps locked tax hint outside the action column", () => {
    assert.match(facts, /booking-details-package-facts/);
    assert.match(facts, /min-w-0 flex-1/);
    assert.match(facts, /invoice-adjustments-locked-hint/);
    // Locked hint must not use basis-full inside the shrink-0 action flex.
    assert.doesNotMatch(facts, /basis-full text-xs text-muted-foreground" data-testid="invoice-adjustments-locked-hint"/);
    const hintIdx = facts.indexOf('data-testid="invoice-adjustments-locked-hint"');
    const actionCloseBeforeHint = facts.lastIndexOf("sm:max-w-[min(100%,20rem)]", hintIdx);
    assert.ok(actionCloseBeforeHint > 0, "action column sizing present before locked hint");
    // Hint is a sibling under the row, after the facts/actions row wrapper closes.
    const rowFactsActions = facts.slice(
      facts.indexOf("booking-details-package-facts"),
      hintIdx,
    );
    assert.match(rowFactsActions, /View \/ Change package/);
    assert.doesNotMatch(rowFactsActions, /Tax and discount for this Selected Package/);
  });
});
