import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("Stage 1E lifecycle subscription safety (source)", () => {
  const src = readFileSync(path.join(__dirname, "route.ts"), "utf8");

  it("requires confirm before creating Checkout Session", () => {
    assert.match(src, /preview_subscription_link/);
    assert.match(src, /confirm !== true/);
    assert.match(src, /confirm_required/);
    assert.match(src, /set_standard_discount_eligibility/);
  });

  it("uses resolved welcome_back from eligibility preview terms", () => {
    assert.match(src, /welcome_back: preview\.terms\.checkoutFlags\.welcome_back/);
    assert.match(src, /idempotencyKey/);
    assert.match(src, /emailDelivery/);
  });
});
