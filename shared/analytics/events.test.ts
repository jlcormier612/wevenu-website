import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MarketingGa4Events, trackPurchase } from "./events";

describe("marketing GA4 event taxonomy", () => {
  it("distinguishes engagement and conversion event names", () => {
    assert.equal(MarketingGa4Events.pricing_view, "view_item_list");
    assert.equal(MarketingGa4Events.cta_click, "select_content");
    assert.equal(MarketingGa4Events.calendly_embed_ready, "calendly_embed_ready");
    assert.equal(MarketingGa4Events.generate_lead, "generate_lead");
    assert.equal(MarketingGa4Events.newsletter_signup, "sign_up");
    assert.equal(MarketingGa4Events.walkthrough_scheduled, "schedule");
    assert.equal(MarketingGa4Events.begin_checkout, "begin_checkout");
    assert.equal(MarketingGa4Events.purchase, "purchase");
    assert.equal(MarketingGa4Events.refer_venue_submit, "generate_lead");
  });

  it("refuses purchase without payment_verified or non-checkout transaction ids", () => {
    assert.equal(
      trackPurchase({
        transaction_id: "cs_test_123",
        payment_verified: false,
      }),
      false,
    );
    assert.equal(
      trackPurchase({
        transaction_id: "sub_renewal_not_checkout",
        payment_verified: true,
      }),
      false,
    );
  });
});
