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
  it("Stripe card has approved not-connected copy + guide link", () => {
    assert.match(stripe, /Allow your clients to conveniently pay online through their client portal\./);
    assert.match(
      stripe,
      /Connect your venue&apos;s Stripe account to accept online payments and receive funds/,
    );
    assert.match(
      stripe,
      /Already have a Stripe account\? Connect your existing account\. If you&apos;re new to/,
    );
    assert.match(stripe, /You&apos;re almost there!/);
    assert.match(stripe, /\/help\/how-to-connect-stripe-for-online-payments/);
    assert.match(stripe, /Need a hand\? Follow our step-by-step Stripe setup guide\./);
    assert.match(stripe, /Connect Stripe/);
    assert.match(stripe, /Complete Stripe Setup/);
    assert.match(stripe, /Refresh status/);
  });

  it("QuickBooks card has approved not-connected/reconnect/connected copy + guide link", () => {
    assert.match(
      qb,
      /Spend less time entering information twice\. Connect QuickBooks Online to automatically sync your venue's customers, invoices, payments and refunds with your accounting records\./,
    );
    assert.match(
      qb,
      /Manage your events and client financials in Hello to Cheers while keeping your books up to date in QuickBooks\./,
    );
    assert.match(qb, /\/help\/how-to-connect-quickbooks-online/);
    assert.match(qb, /Need a hand\? Follow our step-by-step QuickBooks setup guide\./);
    assert.match(qb, /Learn more about your QuickBooks integration/);
    assert.match(qb, /Connect QuickBooks/);
    assert.match(qb, /Reconnect QuickBooks/);
    assert.match(qb, /Let&apos;s get your accounting connected again\./);
    assert.match(qb, /Be sure to select the same QuickBooks company you were previously using\./);
    assert.match(qb, /Connected QuickBooks company/);
  });

  it("Facebook card has approved not-connected/incomplete/connected copy + guide link", () => {
    assert.match(fb, /Facebook & Instagram Lead Ads/);
    assert.match(fb, /Turn advertising inquiries into new opportunities automatically\./);
    assert.match(
      fb,
      /Connect your Facebook business Page and select your lead forms to receive new inquiries from your Facebook and Instagram Lead Ads directly in Hello to Cheers\./,
    );
    assert.match(fb, /Keep all your leads organized in one place, ready for follow-up\./);
    assert.match(fb, /\/help\/how-to-connect-facebook-instagram-lead-ads/);
    assert.match(fb, /Follow our step-by-step Facebook & Instagram Lead Ads setup guide\./);
    assert.match(fb, /View setup guide/);
    assert.match(fb, /Connect Facebook/);
    assert.match(fb, /Setup incomplete/);
    assert.match(fb, /One more step!/);
    assert.match(fb, /Choose Lead Ads forms/);
    assert.match(fb, /Connected Facebook Page/);
    assert.match(fb, /Manage connected forms/);
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
