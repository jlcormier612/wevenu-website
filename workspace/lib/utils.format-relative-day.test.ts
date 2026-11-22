import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatRelativeDay } from "./utils";

describe("formatRelativeDay", () => {
  it("returns em dash for missing or invalid timestamps", () => {
    assert.equal(formatRelativeDay(null), "—");
    assert.equal(formatRelativeDay(undefined), "—");
    assert.equal(formatRelativeDay(""), "—");
    assert.equal(formatRelativeDay("not-a-date"), "—");
  });

  it("still labels today", () => {
    const now = new Date("2026-11-22T15:00:00.000Z");
    assert.equal(formatRelativeDay("2026-11-22T08:00:00.000Z", now), "Today");
  });
});
