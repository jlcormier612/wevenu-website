/**
 * Regression: Settings Connect cards must not show temporary launch-readiness /
 * environment wording. Connect actions stay gated on real configuration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const stripe = readFileSync(join(root, "components/settings/stripe-connect-section.tsx"), "utf8");
const qb = readFileSync(join(root, "components/settings/quickbooks-connect-section.tsx"), "utf8");
const fb = readFileSync(join(root, "components/settings/facebook-connect-section.tsx"), "utf8");

const FORBIDDEN = [
  /isn't ready to start in this environment/i,
  /working Connect button will appear/i,
  /this environment yet/i,
  /Coming soon/i,
  /Connection temporarily unavailable/i,
  /Contact support to get this connected/i,
  /Not available for your account yet/i,
];

describe("Integration Connect cards — no temporary readiness copy", () => {
  for (const [name, src] of [
    ["Stripe", stripe],
    ["QuickBooks", qb],
    ["Facebook", fb],
  ] as const) {
    it(`${name} has no temporary launch-readiness or environment messaging`, () => {
      for (const re of FORBIDDEN) {
        assert.doesNotMatch(src, re, `${name} matched forbidden copy: ${re}`);
      }
    });
  }

  it("Connect actions remain gated on isConfigured", () => {
    assert.match(stripe, /isConfigured \? \(/);
    assert.match(stripe, /Connect Stripe/);
    assert.match(qb, /isConfigured \? \(/);
    assert.match(qb, /Connect QuickBooks/);
    assert.match(fb, /isConfigured \? \(/);
    assert.match(fb, /Connect Facebook/);
  });

  it("approved setup guide links remain on not-connected paths", () => {
    assert.match(stripe, /\/help\/how-to-connect-stripe-for-online-payments/);
    assert.match(qb, /\/help\/how-to-connect-quickbooks-online/);
    assert.match(fb, /\/help\/how-to-connect-facebook-instagram-lead-ads/);
  });
});
