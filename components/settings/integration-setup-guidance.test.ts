/**
 * Settings → Integrations cards wire Before you start + setup guide links.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const stripe = readFileSync(join(root, "components/settings/stripe-connect-section.tsx"), "utf8");
const qb = readFileSync(join(root, "components/settings/quickbooks-connect-section.tsx"), "utf8");
const fb = readFileSync(join(root, "components/settings/facebook-connect-section.tsx"), "utf8");
const page = readFileSync(join(root, "app/(app)/settings/integrations/page.tsx"), "utf8");

describe("Integration card setup guidance wiring", () => {
  it("Stripe card has Before you start + guide link", () => {
    assert.match(stripe, /Before you start:/);
    assert.match(stripe, /Have your Stripe account and business verification information ready/);
    assert.match(stripe, /\/help\/how-to-connect-stripe-for-online-payments/);
    assert.match(stripe, /Need help\? Follow the step-by-step Stripe setup guide/);
    assert.match(stripe, /Connect with Stripe/);
  });

  it("QuickBooks card has Before you start + guide link", () => {
    assert.match(qb, /Before you start:/);
    assert.match(qb, /QuickBooks Primary Admin or Company Admin/);
    assert.match(qb, /\/help\/how-to-connect-quickbooks-online/);
    assert.match(qb, /Need help\? Follow the step-by-step QuickBooks setup guide/);
    assert.match(qb, /Connect with QuickBooks/);
  });

  it("Facebook card has Before you start + guide link", () => {
    assert.match(fb, /Before you start:/);
    assert.match(fb, /correct Facebook Page and know which Lead Ads forms/);
    assert.match(fb, /\/help\/how-to-connect-facebook-instagram-lead-ads/);
    assert.match(
      fb,
      /Need help\? Follow the step-by-step Facebook & Instagram Lead Ads guide/,
    );
    assert.match(fb, /Connect with Facebook/);
    assert.match(fb, /Step 1 of 2/);
    assert.match(fb, /Step 2 of 2/);
    assert.match(fb, /Connect selected forms/);
  });

  it("integrations page no longer uses outdated under-card help links", () => {
    assert.doesNotMatch(page, /SetupGuideLink/);
    assert.doesNotMatch(page, /can-couples-pay-online/);
    assert.doesNotMatch(page, /whats-the-difference-between-a-lead-and-a-client/);
  });
});
