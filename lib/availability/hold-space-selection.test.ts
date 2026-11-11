import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  clearWholeVenue,
  holdSpaceIdsForSubmit,
  selectWholeVenue,
  toggleIndividualSpace,
  type HoldSpaceSelection,
} from "@/lib/availability/hold-space-selection";

const SECTION = readFileSync(resolve("components/availability/date-holds-section.tsx"), "utf8");

const BARN = "barn";
const BRIDGE = "bridge";
const empty: HoldSpaceSelection = { wholeVenue: false, selectedSpaceIds: [] };

describe("hold space selection mutual exclusion", () => {
  it("selecting an individual space clears Whole venue", () => {
    const next = toggleIndividualSpace(selectWholeVenue(), BARN);
    assert.equal(next.wholeVenue, false);
    assert.deepEqual(next.selectedSpaceIds, [BARN]);
  });

  it("selecting a second individual space preserves the first", () => {
    const one = toggleIndividualSpace(empty, BARN);
    const two = toggleIndividualSpace(one, BRIDGE);
    assert.equal(two.wholeVenue, false);
    assert.deepEqual(two.selectedSpaceIds, [BARN, BRIDGE]);
  });

  it("selecting Whole venue clears all individual spaces", () => {
    const multi = toggleIndividualSpace(toggleIndividualSpace(empty, BARN), BRIDGE);
    const whole = selectWholeVenue();
    assert.equal(whole.wholeVenue, true);
    assert.deepEqual(whole.selectedSpaceIds, []);
    assert.deepEqual(holdSpaceIdsForSubmit(whole), []);
    assert.deepEqual(holdSpaceIdsForSubmit(multi), [BARN, BRIDGE]);
    void multi;
  });

  it("unchecking one of several spaces preserves the others", () => {
    const multi = toggleIndividualSpace(toggleIndividualSpace(empty, BARN), BRIDGE);
    const after = toggleIndividualSpace(multi, BARN);
    assert.deepEqual(after.selectedSpaceIds, [BRIDGE]);
    assert.equal(after.wholeVenue, false);
  });

  it("unchecking the final space does not silently select Whole venue", () => {
    const one = toggleIndividualSpace(empty, BARN);
    const after = toggleIndividualSpace(one, BARN);
    assert.deepEqual(after, { wholeVenue: false, selectedSpaceIds: [] });
    assert.deepEqual(clearWholeVenue(), { wholeVenue: false, selectedSpaceIds: [] });
  });

  it("submit payload distinguishes whole-venue vs multi-space", () => {
    assert.deepEqual(holdSpaceIdsForSubmit(selectWholeVenue()), []);
    assert.deepEqual(
      holdSpaceIdsForSubmit({ wholeVenue: false, selectedSpaceIds: [BARN, BRIDGE] }),
      [BARN, BRIDGE],
    );
  });
});

describe("Hold form wires mutual-exclusion helpers", () => {
  it("spaces stay clickable while Whole venue is checked", () => {
    assert.match(SECTION, /toggleIndividualSpace/);
    assert.match(SECTION, /selectWholeVenue/);
    assert.match(SECTION, /clearWholeVenue/);
    assert.match(SECTION, /holdSpaceIdsForSubmit/);
    assert.doesNotMatch(SECTION, /disabled=\{wholeVenue\}/);
  });
});
