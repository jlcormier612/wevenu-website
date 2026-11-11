/**
 * Booking Details package row layout + responsibility guidance copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const facts = readFileSync(resolve("components/booking-journey/commercial-facts.tsx"), "utf8");
const builder = readFileSync(resolve("components/contracts/contract-builder.tsx"), "utf8");

describe("Booking Details package row layout", () => {
  it("gives package facts flex-1 and no longer shows the locked Selected Package tax paragraph", () => {
    assert.match(facts, /booking-details-package-facts/);
    assert.match(facts, /min-w-0 flex-1/);
    assert.doesNotMatch(
      facts,
      /Tax and discount for this Selected Package were set under Tax/,
    );
    assert.doesNotMatch(facts, /invoice-adjustments-locked-hint/);
  });

  it("shows exact responsibility notes on Contract and Invoice / Payment Plan rows only", () => {
    assert.match(facts, /data-testid="contract-responsibility-note"/);
    assert.match(
      facts,
      /You are responsible for your agreement&apos;s terms and policies, including any/,
    );
    assert.match(facts, /data-testid="invoice-payment-plan-responsibility-note"/);
    assert.match(
      facts,
      /Tax and discount additions were\s+set under &apos;Leads &amp; Booking&apos; section in Settings under Invoice/,
    );
    assert.doesNotMatch(facts, /invoice-payment-plan-responsibility-note[\s\S]*invoice-line-items-editor/);
  });
});

describe("Contract Builder agreement guidance", () => {
  it("places venue-responsibility guidance above the editable contract content", () => {
    assert.match(builder, /data-testid="contract-builder-agreement-guidance"/);
    assert.match(builder, /Your agreement, your venue&apos;s terms/);
    assert.match(builder, /not legal or tax\s+advice/);
    const guideIdx = builder.indexOf('data-testid="contract-builder-agreement-guidance"');
    const contentIdx = builder.indexOf('id="cb-content"');
    assert.ok(guideIdx > 0 && contentIdx > guideIdx, "guidance must precede the content editor");
  });
});
