import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hashVenueIdForLayoutTiming,
  isLayoutFirstByteTimingActive,
  layoutFbTime,
  withLayoutFirstByteTiming,
} from "@/lib/shell/layout-first-byte-timing";

describe("layout first-byte timing", () => {
  it("hashes venue ids without returning the raw id", () => {
    const id = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
    const h = hashVenueIdForLayoutTiming(id);
    assert.equal(h.length, 12);
    assert.doesNotMatch(h, /a415ac52/);
    assert.notEqual(h, id);
  });

  it("runs the callback and scopes ALS activity", async () => {
    assert.equal(isLayoutFirstByteTimingActive(), false);
    let saw = false;
    await withLayoutFirstByteTiming(async () => {
      assert.equal(isLayoutFirstByteTimingActive(), true);
      await layoutFbTime("unit_span", async () => {
        saw = true;
      });
    });
    assert.equal(saw, true);
    assert.equal(isLayoutFirstByteTimingActive(), false);
  });
});
