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
  it("publishes all integration setup guides in the final editorial set", () => {
    assert.ok(INTEGRATION_SETUP_ARTICLES.length >= 5);
    for (const a of INTEGRATION_SETUP_ARTICLES) {
      assert.ok(FINAL_HELP_ARTICLES.some((f) => f.slug === a.slug));
      assert.ok(PUBLISHABLE_HELP_ARTICLES.some((f) => f.slug === a.slug));
    }
  });

  it("locks Stripe title, sections, and payment-method decision guidance", () => {
    const a = article("how-to-connect-stripe-for-online-payments");
    assert.equal(a.title, "How to Connect Stripe for Online Payments");
    assert.match(a.body, /Make paying for an event as easy as planning one\./);
    assert.match(a.body, /### Before you begin/);
    assert.match(
      a.body,
      /You do not need to send Hello to Cheers your Stripe password, banking credentials or identification documents\./,
    );
    assert.match(a.body, /### Step 1 — Connect Stripe/);
    assert.match(a.body, /click \*\*Connect Stripe\*\*/);
    assert.match(a.body, /### Step 2 — Sign in or create your account/);
    assert.match(a.body, /### Already have a Stripe account\?/);
    assert.match(a.body, /You don't need to create another account simply because you're using Hello to Cheers\./);
    assert.match(a.body, /### Step 3 — Tell Stripe about your venue/);
    assert.match(
      a.body,
      /Entertainment and recreation → Other entertainment and recreation/,
    );
    assert.match(a.body, /### Step 4 — Verify your business and identity/);
    assert.match(a.body, /### Step 5 — Set up your bank account/);
    assert.match(a.body, /### Step 6 — Review and authorize the connection/);
    assert.match(a.body, /### Step 7 — Confirm you're ready to accept payments/);
    assert.match(a.body, /### Connected, setup incomplete/);
    assert.match(a.body, /Complete Stripe Setup/);
    assert.match(a.body, /Refresh status/);
    assert.match(a.body, /### Step 8 — Choose your accepted payment methods/);
    assert.match(a.body, /### Credit\/Debit Card/);
    assert.match(a.body, /### ACH Bank Transfer/);
    assert.match(a.body, /Processing fees and settlement times are determined by Stripe\./);
    assert.match(a.body, /### Frequently asked questions/);
    assert.match(a.body, /### Additional Stripe resources/);
    assert.match(a.body, /https:\/\/support\.stripe\.com\//);
    assert.doesNotMatch(a.body, /\bOAuth\b|\bAPI\b|\baccess token\b|\bwebhook\b/i);
  });

  it("locks QuickBooks title, company selection, sync scope, and one-way behavior", () => {
    const a = article("how-to-connect-quickbooks-online");
    assert.equal(a.title, "How to Connect QuickBooks Online");
    assert.match(a.body, /Your event management and accounting should work together\./);
    assert.match(a.body, /### Before you begin/);
    assert.match(a.body, /Primary Admin or Company Admin/);
    assert.match(a.body, /### Step 1 — Connect QuickBooks/);
    assert.match(a.body, /click \*\*Connect QuickBooks\*\*/);
    assert.match(a.body, /### Step 2 — Sign in to your Intuit account/);
    assert.match(a.body, /### Already using QuickBooks Online\?/);
    assert.match(a.body, /There's no need to create another account to connect with Hello to Cheers\./);
    assert.match(a.body, /### New to QuickBooks Online\?/);
    assert.match(a.body, /### Step 3 — Select your QuickBooks company/);
    assert.match(a.body, /This is where your customers, invoices, payments and refunds from Hello to Cheers will be synced\./);
    assert.match(a.body, /### Step 4 — Authorize the connection/);
    assert.match(a.body, /Your Intuit login credentials remain with Intuit\./);
    assert.match(a.body, /### Step 5 — Confirm your connection/);
    assert.match(a.body, /### Step 6 — Review your accounting preferences/);
    assert.match(a.body, /### What information syncs with QuickBooks\?/);
    assert.match(a.body, /### Customers/);
    assert.match(a.body, /### Invoices/);
    assert.match(a.body, /### Payments/);
    assert.match(a.body, /### Refunds/);
    assert.match(
      a.body,
      /Changes made directly in QuickBooks do not automatically update your corresponding event records in Hello to Cheers\./,
    );
    assert.match(a.body, /### Connected, last sync failed/);
    assert.match(a.body, /Hello to Cheers automatically retries eligible syncs/);
    assert.match(a.body, /### Frequently asked questions/);
    assert.match(a.body, /### Additional QuickBooks resources/);
    assert.match(a.body, /https:\/\/quickbooks\.intuit\.com\/learn-support\//);
    assert.doesNotMatch(a.body, /\brealm ID\b|\bOAuth\b|\baccess token\b/i);
  });

  it("locks Facebook title, Page/form decisions, and Instagram clarification", () => {
    const a = article("how-to-connect-facebook-instagram-lead-ads");
    assert.equal(a.title, "How to Connect Facebook & Instagram Lead Ads");
    assert.match(a.body, /Turn interest in your venue into new opportunities\./);
    assert.match(a.body, /### Before you begin/);
    assert.match(a.body, /### Understanding your Meta accounts/);
    assert.match(a.body, /### Step 1 — Connect Facebook/);
    assert.match(a.body, /click \*\*Connect Facebook\*\*/);
    assert.match(a.body, /### Step 2 — Sign in to Facebook/);
    assert.match(a.body, /### Step 3 — Select your business and Page/);
    assert.match(a.body, /### Choose your Business Portfolio/);
    assert.match(a.body, /### Choose your Facebook Page/);
    assert.match(a.body, /### Step 4 — Review and authorize permissions/);
    assert.doesNotMatch(a.body, /pages_show_list|leads_retrieval|pages_manage_ads|pages_read_engagement/);
    assert.match(a.body, /### Step 5 — Confirm your Facebook Page/);
    assert.match(a.body, /### Step 6 — Choose your Lead Ads forms/);
    assert.match(a.body, /Click \*\*Connect selected forms\*\*/);
    assert.match(
      a.body,
      /Your setup is complete when your Page is connected and at least one lead form is enabled\./,
    );
    assert.match(a.body, /### Don't have any lead forms yet\?/);
    assert.match(a.body, /### Step 7 — Include your Instagram Lead Ads/);
    assert.match(a.body, /There's no separate Instagram connection to set up in Hello to Cheers\./);
    assert.match(a.body, /### Step 8 — Test your connection/);
    assert.match(a.body, /https:\/\/developers\.facebook\.com\/tools\/lead-ads-testing\//);
    assert.match(a.body, /### Frequently asked questions/);
    assert.match(a.body, /### Additional Meta resources/);
    assert.doesNotMatch(a.body, /\bOAuth\b|\bwebhook\b|\bscope\b|\baccess token\b/i);
  });

  it("locks Website Inquiry Form title, embed/link options, and provider docs", () => {
    const a = article("how-to-add-your-inquiry-form-to-your-website");
    assert.equal(a.title, "How to Add Your Inquiry Form to Your Website");
    assert.match(a.body, /Make it easy for prospective clients to take the first step toward celebrating at your venue\./);
    assert.match(a.body, /### Step 1 — Make your inquiry form your own/);
    assert.match(a.body, /### Option A — Display your form directly on your website/);
    assert.match(a.body, /### Option B — Share a direct link to your form/);
    assert.match(a.body, /You can share this link anywhere you'd like to invite prospective clients to inquire, including:/);
    assert.match(a.body, /When someone clicks your link, they'll be taken directly to your venue's inquiry form\./);
    assert.match(a.body, /\*\*Inquire Now\*\*/);
    assert.match(a.body, /### Squarespace/);
    assert.match(a.body, /https:\/\/support\.squarespace\.com\/hc\/en-us\/articles\/206543167/);
    assert.match(a.body, /### Wix/);
    assert.match(a.body, /https:\/\/support\.wix\.com\/en\/article\/wix-editor-embedding-a-site-or-a-widget/);
    assert.match(a.body, /### WordPress/);
    assert.match(a.body, /https:\/\/wordpress\.org\/documentation\/article\/custom-html\//);
    assert.match(a.body, /QR code tools available in Hello to Cheers/);
    assert.match(a.body, /### Frequently asked questions/);
    assert.match(a.body, /### Additional website resources/);
    assert.match(a.body, /https:\/\/elementor\.com\/help\//);
  });

  it("locks Email Inquiry Intake title, automatic-forwarding path, and provider links", () => {
    const a = article("how-to-automatically-forward-inquiries-to-hello-to-cheers");
    assert.equal(a.title, "How to Automatically Forward Inquiries to Hello to Cheers");
    assert.match(a.body, /Spend less time checking different inboxes and more time connecting with prospective clients\./);
    assert.match(a.body, /### Step 1 — Find your unique inquiry email address/);
    assert.match(a.body, /### Option A — Forward inquiries automatically from your existing inbox/);
    assert.match(a.body, /\*\*Recommended for most venues\.\*\*/);
    assert.match(a.body, /### Option B — Receive inquiries directly from your listing or advertising service/);
    assert.match(a.body, /### The Knot and WeddingWire/);
    assert.match(a.body, /### Here Comes The Guide/);
    assert.match(a.body, /### Gmail and Google Workspace/);
    assert.match(a.body, /### Completing Google's verification in Hello to Cheers/);
    assert.match(a.body, /Confirm forwarding with Google/);
    assert.match(a.body, /Google requires verification of your forwarding destination before automatic forwarding can begin\./);
    assert.match(a.body, /https:\/\/support\.google\.com\/mail\/answer\/10957/);
    assert.match(a.body, /### Outlook and Microsoft 365/);
    assert.match(a.body, /https:\/\/support\.microsoft\.com\/en-us\/outlook\/mail\/use-rules-to-automatically-forward-messages/);
    assert.match(a.body, /### Forwarding individual inquiries/);
    assert.match(a.body, /### Frequently asked questions/);
    assert.match(a.body, /### Bringing over existing inquiries/);
    assert.match(a.body, /Visit \*\*Bring Your Business\*\* in your Setup Hub to explore your import options\./);
    assert.doesNotMatch(a.body, /bulk forward|multipart\/rfc822/i);
  });

  it("links each guide back to the matching Settings destination", () => {
    assert.deepEqual(article("how-to-connect-stripe-for-online-payments").relatedFeatures, [
      { href: "/settings/integrations#stripe", label: "Open Stripe settings" },
    ]);
    assert.deepEqual(article("how-to-connect-quickbooks-online").relatedFeatures, [
      { href: "/settings/integrations#quickbooks", label: "Open QuickBooks settings" },
    ]);
    assert.deepEqual(article("how-to-connect-facebook-instagram-lead-ads").relatedFeatures, [
      { href: "/settings/integrations#facebook", label: "Open Facebook & Instagram Lead Ads settings" },
    ]);
    assert.deepEqual(article("how-to-automatically-forward-inquiries-to-hello-to-cheers").relatedFeatures, [
      { href: "/settings/leads#email-intake", label: "Open Email Inquiry Intake settings" },
    ]);
    assert.deepEqual(article("how-to-add-your-inquiry-form-to-your-website").relatedFeatures, [
      { href: "/settings/leads#inquiry", label: "Open Website Inquiry Form settings" },
    ]);
    assert.deepEqual(article("how-texting-setup-works").relatedFeatures, [
      { href: "/settings/communications#texting", label: "Open Text messaging setup" },
    ]);
  });

  it("texting setup guide matches approved registration path (no invented ETAs)", () => {
    const a = article("how-texting-setup-works");
    assert.equal(a.title, "How to Set Up Text Messaging");
    assert.match(a.body, /sometimes a text is the easiest way to stay connected/);
    assert.match(a.body, /### Before you begin/);
    assert.match(a.body, /### Step 1 — Start your texting setup/);
    assert.match(a.body, /Select \*\*Enable text messaging\*\*/);
    assert.match(a.body, /### Step 7 — Follow your registration progress/);
    assert.match(a.body, /### Ready/);
    assert.match(a.body, /### Frequently asked questions/);
    assert.match(a.body, /Do I need to create a separate Twilio account\?/);
    assert.match(a.body, /https:\/\/www\.twilio\.com\/docs\/messaging\/compliance\/a2p-10dlc/);
    assert.match(a.body, /Communication Health/);
    assert.doesNotMatch(a.body, /Trust Hub|Account SID|Auth Token/i);
    assert.doesNotMatch(a.body, /\bETA\b|within \d+ (days|hours)|usually takes/i);
  });

  it("locks Refer a Venue Help article title and program rules", () => {
    const a = article("refer-a-venue-one-referral-one-free-month");
    assert.equal(a.title, "Refer a Venue — One Referral. One FREE Month.");
    assert.match(a.body, /We know how valuable recommendations from fellow venue owners can be/);
    assert.match(a.body, /### Step 1 — Tell us about a venue/);
    assert.match(a.body, /### Step 2 — We'll introduce them to Hello to Cheers/);
    assert.match(a.body, /### Step 3 — Enjoy your reward/);
    assert.match(a.body, /completes 30 days as a qualifying paying subscriber/);
    assert.match(a.body, /Self-referrals and duplicate rewards are not eligible/);
    assert.match(a.body, /\*\*Who can I refer\?\*\*/);
    assert.deepEqual(a.relatedFeatures, [
      { href: "/settings/referrals", label: "Open Refer a Venue" },
    ]);
  });

  it("Website Inquiry Form Option B uses approved share-link list order", () => {
    const a = article("how-to-add-your-inquiry-form-to-your-website");
    assert.match(
      a.body,
      /### Option B — Share a direct link to your form\n\nYour inquiry form also has its own unique web address\.\n\nYou can share this link anywhere/,
    );
    const share = a.body.indexOf("You can share this link anywhere");
    const click = a.body.indexOf("When someone clicks your link, they'll be taken directly");
    assert.ok(share > 0 && click > share);
  });
});
