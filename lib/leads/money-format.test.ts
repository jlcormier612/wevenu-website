import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCurrency,
  formatMoneyInputDisplay,
  parseMoneyInput,
} from "@/lib/leads/constants";

describe("USD money display formatting", () => {
  it("formats whole dollars without trailing .00", () => {
    assert.equal(formatCurrency(0), "$0");
    assert.equal(formatCurrency(5), "$5");
    assert.equal(formatCurrency(1250), "$1,250");
    assert.equal(formatCurrency(20000), "$20,000");
    assert.equal(formatCurrency(20000.0), "$20,000");
    assert.equal(formatCurrency(9999999), "$9,999,999");
  });

  it("keeps cents when present", () => {
    assert.equal(formatCurrency(20.5), "$20.50");
    assert.equal(formatCurrency(20.05), "$20.05");
    assert.equal(formatCurrency(1250.5), "$1,250.50");
    assert.equal(formatCurrency(9999999.99), "$9,999,999.99");
  });

  it("null stays empty (not $0)", () => {
    assert.equal(formatCurrency(null), "");
    assert.equal(formatCurrency(undefined), "");
  });

  it("parseMoneyInput strips currency decoration for storage", () => {
    assert.equal(parseMoneyInput("$20,000"), "20000");
    assert.equal(parseMoneyInput("20000"), "20000");
    assert.equal(parseMoneyInput("$1,250.50"), "1250.5");
    assert.equal(parseMoneyInput(""), "");
    assert.equal(parseMoneyInput("   "), "");
  });

  it("formatMoneyInputDisplay formats on blur without inventing zero", () => {
    assert.equal(formatMoneyInputDisplay("20000"), "$20,000");
    assert.equal(formatMoneyInputDisplay("$20,000"), "$20,000");
    assert.equal(formatMoneyInputDisplay(""), "");
  });
});
