import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultHoldDateFromDesiredEventDate } from "@/lib/availability/hold-defaults";

describe("defaultHoldDateFromDesiredEventDate", () => {
  it("defaults hold date to the authoritative desired event date (screenshot regression 2027-02-14)", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-02-14"), "2027-02-14");
  });

  it("preserves year across year boundaries", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate("2026-12-31"), "2026-12-31");
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-01-01"), "2027-01-01");
  });

  it("preserves month boundaries", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-01-31"), "2027-01-31");
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-03-01"), "2027-03-01");
  });

  it("returns empty when desired date is missing or malformed", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate(null), "");
    assert.equal(defaultHoldDateFromDesiredEventDate(undefined), "");
    assert.equal(defaultHoldDateFromDesiredEventDate(""), "");
    assert.equal(defaultHoldDateFromDesiredEventDate("02/14/2027"), "");
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-02-14T00:00:00Z"), "");
    assert.equal(defaultHoldDateFromDesiredEventDate("not-a-date"), "");
  });

  it("rejects impossible calendar dates without inventing a nearby day", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-02-30"), "");
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-13-01"), "");
  });
});
