/**
 * Product-locked integration setup guides — content QA against the approved brief.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { INTEGRATION_SETUP_ARTICLES } from "@/lib/help-guides/integration-setup-articles";
import { FINAL_HELP_ARTICLES, PUBLISHABLE_HELP_ARTICLES } from "@/lib/help-guides/final-articles";

function article(slug: string) {
  const a = INTEGRATION_SETUP_ARTICLES.find((x) => x.slug === slug);
  assert.ok(a, `missing article ${slug}`);
  return a;
}

describe("Integration setup guides (product-locked)", () => {
  it("publishes exactly three setup guides in the final editorial set", () => {
    assert.equal(INTEGRATION_SETUP_ARTICLES.length, 3);
    for (const a of INTEGRATION_SETUP_ARTICLES) {
      assert.ok(FINAL_HELP_ARTICLES.some((f) => f.slug === a.slug));
      assert.ok(PUBLISHABLE_HELP_ARTICLES.some((f) => f.slug === a.slug));
    }
  });

  it("locks Stripe title, sections, and payment-method decision guidance", () => {
    const a = article("how-to-connect-stripe-for-online-payments");
    assert.equal(a.title, "How to Connect Stripe for Online Payments");
    assert.match(a.body, /### Before you start/);
    assert.match(a.body, /\*\*Have your Stripe account ready\*\*/);
    assert.match(a.body, /Hello to Cheers never sees your Stripe password or holds your money/);
    assert.match(a.body, /### You'll need/);
    assert.match(a.body, /### Step 1 — Connect Stripe/);
    assert.match(a.body, /Connect with Stripe/);
    assert.match(a.body, /### Step 2 — Sign in to Stripe/);
    assert.match(a.body, /Don't create a second Stripe account just for Hello to Cheers/);
    assert.match(a.body, /### Step 3 — Enter your business information/);
    assert.match(a.body, /\*\*Use your venue's real business information\*\*/);
    assert.match(a.body, /### Step 4 — Complete identity verification/);
    assert.match(a.body, /Hello to Cheers does not need a copy of your ID/);
    assert.match(a.body, /### Step 5 — Enter bank\/payout information/);
    assert.match(a.body, /Hello to Cheers does not hold your money/);
    assert.match(a.body, /### Step 6 — Review and authorize/);
    assert.match(a.body, /### Step 7 — Return to Hello to Cheers/);
    assert.match(a.body, /\*\*Connected\*\*/);
    assert.match(a.body, /\*\*Connected, setup incomplete\*\*/);
    assert.match(a.body, /### Step 8 — Choose your accepted payment methods/);
    assert.match(a.body, /Which payment methods should I turn on\?/);
    assert.match(a.body, /\*\*Credit\/Debit Card\*\*/);
    assert.match(a.body, /\*\*ACH Bank Transfer\*\*/);
    assert.match(a.body, /You can choose both/);
    assert.match(a.body, /If you're unsure, start with Credit\/Debit Card/);
    assert.match(a.body, /inside Hello to Cheers/);
    assert.doesNotMatch(a.body, /\bOAuth\b|\bAPI\b|\baccess token\b|\bwebhook\b/i);
  });

  it("locks QuickBooks title, company-choice warning, and source-of-truth copy", () => {
    const a = article("how-to-connect-quickbooks-online");
    assert.equal(a.title, "How to Connect QuickBooks Online");
    assert.match(a.body, /### Before you start/);
    assert.match(a.body, /\*\*Before you connect\*\*/);
    assert.match(a.body, /Primary Admin or Company Admin/);
    assert.match(a.body, /### Step 1 — Connect QuickBooks/);
    assert.match(a.body, /Connect with QuickBooks/);
    assert.match(a.body, /### Step 2 — Sign in to Intuit/);
    assert.match(a.body, /do not create another Intuit account/);
    assert.match(a.body, /### Step 3 — Choose the QuickBooks company/);
    assert.match(a.body, /\*\*Choose carefully\*\*/);
    assert.match(a.body, /do not simply choose the first company shown/);
    assert.match(a.body, /### Step 4 — Authorize Hello to Cheers/);
    assert.match(a.body, /Connect \/ Authorize/);
    assert.match(a.body, /### Step 5 — Return to Hello to Cheers/);
    assert.match(a.body, /Connected to \[QuickBooks company name\]/);
    assert.match(a.body, /### What QuickBooks syncs/);
    assert.match(a.body, /- Customers/);
    assert.match(a.body, /- Invoices/);
    assert.match(a.body, /- Payments/);
    assert.match(a.body, /- Refunds/);
    assert.match(a.body, /Hello to Cheers remains the source of truth/);
    assert.match(a.body, /retries automatically/);
    assert.doesNotMatch(a.body, /\brealm ID\b|\bOAuth\b|\baccess token\b/i);
  });

  it("locks Facebook title, Page/form decisions, and Instagram clarification", () => {
    const a = article("how-to-connect-facebook-instagram-lead-ads");
    assert.equal(a.title, "How to Connect Facebook & Instagram Lead Ads");
    assert.match(a.body, /### Before you start/);
    assert.match(a.body, /\*\*Before you connect Facebook \/ Instagram Lead Ads\*\*/);
    assert.match(a.body, /Instagram does not need to be connected separately/);
    assert.match(a.body, /### Step 1 — Connect Facebook/);
    assert.match(a.body, /Connect with Facebook/);
    assert.match(
      a.body,
      /Connecting Facebook alone does not send leads into Hello to Cheers\. You must select at least one Lead Ads form/,
    );
    assert.match(a.body, /### Step 2 — Sign in to Meta/);
    assert.match(a.body, /### Step 3 — Review Meta permissions/);
    assert.match(a.body, /Meta is asking for permission to connect your Page/);
    assert.doesNotMatch(a.body, /pages_show_list|leads_retrieval|pages_manage_ads|pages_read_engagement/);
    assert.match(a.body, /### Step 4 — Choose your business and Page in Meta/);
    assert.match(a.body, /Continue as \[your name\]/);
    assert.match(a.body, /### Step 5 — Select a Facebook Page in Hello to Cheers/);
    assert.match(a.body, /Step 1 of 2 — Select a Facebook Page/);
    assert.match(a.body, /Which Page should I choose\?/);
    assert.match(a.body, /### Step 6 — Choose Lead Ads forms/);
    assert.match(a.body, /Step 2 of 2 — Choose Lead Ads forms/);
    assert.match(a.body, /Connect selected forms/);
    assert.match(a.body, /You must select at least one form/);
    assert.match(a.body, /### Step 7 — Connected/);
    assert.match(a.body, /Connected to \[Page Name\]/);
    assert.doesNotMatch(a.body, /\bOAuth\b|\bwebhook\b|\bscope\b|\baccess token\b/i);
  });

  it("links each guide back to the matching Integrations card anchor", () => {
    assert.deepEqual(article("how-to-connect-stripe-for-online-payments").relatedFeatures, [
      { href: "/settings/integrations#stripe", label: "Open Stripe settings" },
    ]);
    assert.deepEqual(article("how-to-connect-quickbooks-online").relatedFeatures, [
      { href: "/settings/integrations#quickbooks", label: "Open QuickBooks settings" },
    ]);
    assert.deepEqual(article("how-to-connect-facebook-instagram-lead-ads").relatedFeatures, [
      { href: "/settings/integrations#facebook", label: "Open Facebook & Instagram Lead Ads settings" },
    ]);
  });
});
