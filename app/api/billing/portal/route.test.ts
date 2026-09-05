import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("SaaS billing portal never uses Connect Stripe credentials", () => {
  const source = readFileSync(resolve("app/api/billing/portal/route.ts"), "utf8");

  it("proxies only to marketing /api/stripe/portal for saas_stripe_customer_id", () => {
    assert.match(source, /saas_stripe_customer_id/);
    assert.match(source, /\/api\/stripe\/portal/);
    assert.match(source, /NEXT_PUBLIC_MARKETING_URL|MARKETING_SITE_URL/);
  });

  it("does not construct a Connect-account Billing Portal session in venue-app", () => {
    assert.doesNotMatch(source, /getStripeClient/);
    assert.doesNotMatch(source, /billingPortal\.sessions\.create/);
    assert.doesNotMatch(source, /from \"@\/lib\/stripe\/config\"/);
  });
});
