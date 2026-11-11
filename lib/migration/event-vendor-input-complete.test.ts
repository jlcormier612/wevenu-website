import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("event vendor assignment builds a complete VendorInput", () => {
  it("does not cast a partial object as VendorInput", () => {
    const src = readFileSync("lib/migration/event-vendor-assignment.ts", "utf8");
    const start = src.indexOf("const input");
    const end = src.indexOf("insertVendor", start);
    const body = src.slice(start, end);
    assert.match(body, /VendorInput\s*=/);
    assert.doesNotMatch(body, /as VendorInput/);
    assert.match(body, /isRequired:\s*false/);
    assert.match(body, /isInHouse:\s*false/);
    assert.match(body, /specialPricingNote:/);
  });
});
