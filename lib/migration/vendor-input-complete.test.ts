import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("MC toVendorInput supplies every VendorInput string field", () => {
  it("includes notes, description, specialPricingNote, and flags (no undefined.trim)", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf("function toVendorInput");
    const end = src.indexOf("\nfunction ", start + 1);
    const body = src.slice(start, end > start ? end : start + 800);
    for (const key of [
      "notes:",
      "description:",
      "specialPricingNote:",
      "logoUrl:",
      "pricingTier:",
      "isRequired:",
      "isInHouse:",
    ]) {
      assert.match(body, new RegExp(key.replace(":", "\\s*:")));
    }
    assert.doesNotMatch(body, /as any/);
  });
});
