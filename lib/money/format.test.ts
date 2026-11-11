import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatMoneyDisplay } from "@/lib/money/format";

describe("canonical money display", () => {
  it("formats whole USD amounts without trailing .00", () => {
    assert.equal(formatMoneyDisplay(0), "$0");
    assert.equal(formatMoneyDisplay(5), "$5");
    assert.equal(formatMoneyDisplay(1250), "$1,250");
    assert.equal(formatMoneyDisplay(20000), "$20,000");
    assert.equal(formatMoneyDisplay(20000.0), "$20,000");
  });

  it("keeps cents when present", () => {
    assert.equal(formatMoneyDisplay(20.5), "$20.50");
    assert.equal(formatMoneyDisplay(20.05), "$20.05");
    assert.equal(formatMoneyDisplay(1250.5), "$1,250.50");
  });

  it("null and non-finite stay empty", () => {
    assert.equal(formatMoneyDisplay(null), "");
    assert.equal(formatMoneyDisplay(undefined), "");
    assert.equal(formatMoneyDisplay(Number.NaN), "");
  });

  it("formats negatives and supports other currencies", () => {
    assert.equal(formatMoneyDisplay(-20000), "-$20,000");
    assert.equal(formatMoneyDisplay(20000, "CAD"), "CA$20,000");
  });
});
