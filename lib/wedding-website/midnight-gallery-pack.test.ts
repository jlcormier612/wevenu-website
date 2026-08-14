import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  midnightSupportGridColumn,
  pickMidnightSupportColumns,
} from "@/lib/wedding-website/midnight-gallery-pack";

describe("pickMidnightSupportColumns", () => {
  it("uses a single-row fit for 1–4 supports", () => {
    assert.equal(pickMidnightSupportColumns(1), 1);
    assert.equal(pickMidnightSupportColumns(2), 2);
    assert.equal(pickMidnightSupportColumns(3), 3);
    assert.equal(pickMidnightSupportColumns(4), 4);
  });

  it("5 supports → 4 cols (fewer rows, tinier remainder than 3)", () => {
    // 4→2 rows rem 1; 3→2 rows rem 2; 2→3 rows. Prefer fewer rows then smaller rem.
    assert.equal(pickMidnightSupportColumns(5), 4);
  });

  it("6 supports → 3 cols (exact divisor, fuller than 2)", () => {
    assert.equal(pickMidnightSupportColumns(6), 3);
  });

  it("7 supports → 4 cols (fewer rows than 3 or 2)", () => {
    // 4→2 rows rem 3; 3→3 rows rem 1; 2→4 rows rem 1.
    assert.equal(pickMidnightSupportColumns(7), 4);
  });

  it("8 supports → 4 cols (exact divisor, fuller than 2)", () => {
    assert.equal(pickMidnightSupportColumns(8), 4);
  });

  it("never returns 5 (hard-cap orphan row)", () => {
    for (let n = 1; n <= 12; n++) {
      assert.notEqual(pickMidnightSupportColumns(n), 5);
    }
  });
});

describe("midnightSupportGridColumn", () => {
  it("leaves full rows unplaced (auto flow)", () => {
    assert.equal(midnightSupportGridColumn(0, 6, 3), undefined);
    assert.equal(midnightSupportGridColumn(5, 6, 3), undefined);
  });

  it("centers a single remainder of 5-in-4 with span 2", () => {
    // Last item (index 4) of 5 in a 4-col grid.
    assert.equal(midnightSupportGridColumn(4, 5, 4), "2 / span 2");
    assert.equal(midnightSupportGridColumn(0, 5, 4), undefined);
  });

  it("centers a 3-wide last row in a 4-col grid (7 supports)", () => {
    // Indices 4,5,6 on last row → cols 1,2,3 (offset floor((4-3)/2)+1 = 1)
    assert.equal(midnightSupportGridColumn(4, 7, 4), "1");
    assert.equal(midnightSupportGridColumn(5, 7, 4), "2");
    assert.equal(midnightSupportGridColumn(6, 7, 4), "3");
  });
});
