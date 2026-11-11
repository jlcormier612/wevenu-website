import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectSetupConciergeEntry } from "@/lib/setup-concierge/select";
import { emptyVenueSetupSnapshot } from "@/lib/setup-concierge/types";

const BASE = emptyVenueSetupSnapshot();

describe("selectSetupConciergeEntry", () => {
  it("returns null after Ready to Invite Couples", () => {
    assert.equal(selectSetupConciergeEntry(emptyVenueSetupSnapshot({ readyToInviteCouples: true })), null);
  });

  it("is silent when required work is done, Stripe was skipped, and optional integrations never started", () => {
    assert.equal(selectSetupConciergeEntry(BASE), null);
  });

  it("prioritizes texting BLOCKED over missing profile", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      hasAddress: false,
      textingPhase: "needs_attention",
      financialsReviewedAt: "x",
    }));
    assert.equal(entry?.domain, "texting");
    assert.equal(entry?.kind, "action");
  });

  it("prioritizes profile before package before inquiry path", () => {
    const profile = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      hasName: false,
      authoredActivePackageCount: 0,
      leadCapturePath: null,
      financialsReviewedAt: "x",
    }));
    assert.equal(profile?.domain, "profile");

    const pack = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      authoredActivePackageCount: 0,
      leadCapturePath: null,
      financialsReviewedAt: "x",
    }));
    assert.equal(pack?.domain, "package");

    const inquiry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      leadCapturePath: null,
      inquiryFormReceivedLead: false,
      financialsReviewedAt: "x",
    }));
    assert.equal(inquiry?.domain, "inquiry_path");
  });

  it("manual path is not blocked without a website lead", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      leadCapturePath: "manual_external",
      inquiryFormReceivedLead: false,
      financialsReviewedAt: "x",
    }));
    assert.equal(entry, null);
  });

  it("automated with zero website leads asks to share/test the form", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      leadCapturePath: "automated",
      inquiryFormReceivedLead: false,
      financialsReviewedAt: "x",
    }));
    assert.equal(entry?.domain, "website_delivery");
    assert.match(entry?.body ?? "", /test inquiry/i);
    assert.doesNotMatch(entry?.title ?? "", /website is working/i);
    assert.match(entry?.cannotSee ?? "", /live website/i);
  });

  it("does not treat Facebook delivering as inquiry completion", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      leadCapturePath: null,
      inquiryFormReceivedLead: false,
      facebookUiState: "delivering",
      financialsReviewedAt: "x",
    }));
    assert.equal(entry?.domain, "inquiry_path");
  });

  it("does not nag Stripe after I'll do this later", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      stripeChargesEnabled: false,
      stripeOnboardingStatus: "not_started",
      financialsReviewedAt: "2026-10-01T00:00:00.000Z",
    }));
    assert.equal(entry, null);
  });

  it("asks to connect Stripe only when it was not skipped", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      stripeChargesEnabled: false,
      stripeOnboardingStatus: "not_started",
      financialsReviewedAt: null,
    }));
    assert.equal(entry?.domain, "stripe");
    assert.equal(entry?.kind, "action");
  });

  it("omits absent Facebook from the queue", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      facebookUiState: "not_connected",
      financialsReviewedAt: "x",
    }));
    assert.equal(entry, null);
  });

  it("surfaces Facebook Page/forms after required and Stripe connect", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      facebookUiState: "needs_page_selection",
      financialsReviewedAt: "x",
    }));
    assert.equal(entry?.domain, "facebook");
  });

  it("shows a single Stripe wait card when charges are pending", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      stripeOnboardingStatus: "connected",
      stripeChargesEnabled: false,
      financialsReviewedAt: null,
    }));
    assert.equal(entry?.domain, "stripe");
    assert.equal(entry?.kind, "waiting");
    assert.match(entry?.title ?? "", /finish enabling charges/i);
  });

  it("returns exactly one domain", () => {
    const entry = selectSetupConciergeEntry(emptyVenueSetupSnapshot({
      hasAddress: false,
      authoredActivePackageCount: 0,
      textingPhase: "failed",
    }));
    assert.equal(entry?.domain, "texting");
    assert.equal(typeof entry?.title, "string");
  });
});
