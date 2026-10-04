import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateVenueSetupDomains } from "@/lib/setup-concierge/state";
import { emptyVenueSetupSnapshot } from "@/lib/setup-concierge/types";

function domain(snapshot: Parameters<typeof evaluateVenueSetupDomains>[0], id: string) {
  return evaluateVenueSetupDomains(snapshot).find((d) => d.domain === id) ?? null;
}

describe("evaluateVenueSetupDomains", () => {
  it("profile waits when contact fields are missing", () => {
    const d = domain(emptyVenueSetupSnapshot({ hasAddress: false }), "profile");
    assert.equal(d?.state, "WAITING_ON_VENUE");
  });

  it("package ready only for authored active packages", () => {
    assert.equal(domain(emptyVenueSetupSnapshot({ authoredActivePackageCount: 0 }), "package")?.state, "WAITING_ON_VENUE");
    assert.equal(domain(emptyVenueSetupSnapshot({ authoredActivePackageCount: 1 }), "package")?.state, "READY");
    assert.equal(domain(emptyVenueSetupSnapshot({ authoredActivePackageCount: null }), "package"), null);
  });

  it("manual path is ready and website delivery is not applicable", () => {
    const snap = emptyVenueSetupSnapshot({
      leadCapturePath: "manual_external",
      inquiryFormReceivedLead: false,
    });
    assert.equal(domain(snap, "inquiry_path")?.state, "READY");
    assert.equal(domain(snap, "website_delivery")?.state, "NOT_APPLICABLE");
  });

  it("automated with no website lead waits on sharing the form, not on tour hours", () => {
    const snap = emptyVenueSetupSnapshot({
      leadCapturePath: "automated",
      inquiryFormReceivedLead: false,
      inquiryFormReady: true,
    });
    assert.equal(domain(snap, "inquiry_path")?.state, "READY");
    assert.equal(domain(snap, "website_delivery")?.state, "WAITING_ON_VENUE");
    assert.match(domain(snap, "website_delivery")!.cannotSee ?? "", /live website/i);
  });

  it("does not treat a failed website-lead lookup as zero", () => {
    const snap = emptyVenueSetupSnapshot({
      leadCapturePath: "automated",
      inquiryFormReceivedLead: null,
    });
    assert.equal(domain(snap, "website_delivery"), null);
  });

  it("Stripe later is NOT_APPLICABLE when charges are off", () => {
    const snap = emptyVenueSetupSnapshot({
      stripeChargesEnabled: false,
      stripeOnboardingStatus: "not_started",
      financialsReviewedAt: "2026-10-01T00:00:00.000Z",
    });
    assert.equal(domain(snap, "stripe")?.state, "NOT_APPLICABLE");
  });

  it("Stripe charges enabled is READY even after later", () => {
    const snap = emptyVenueSetupSnapshot({
      stripeChargesEnabled: true,
      stripeOnboardingStatus: "connected",
      financialsReviewedAt: "2026-10-01T00:00:00.000Z",
    });
    assert.equal(domain(snap, "stripe")?.state, "READY");
  });

  it("connected Stripe without charges waits on Stripe, not the venue", () => {
    const snap = emptyVenueSetupSnapshot({
      stripeChargesEnabled: false,
      stripeOnboardingStatus: "connected",
      financialsReviewedAt: null,
    });
    assert.equal(domain(snap, "stripe")?.state, "WAITING_ON_EXTERNAL");
  });

  it("omits Facebook when never started and texting when not_started", () => {
    const snap = emptyVenueSetupSnapshot({
      facebookUiState: "not_connected",
      textingPhase: "not_started",
    });
    assert.equal(domain(snap, "facebook"), null);
    assert.equal(domain(snap, "texting"), null);
  });

  it("Facebook error is BLOCKED; needs_forms waits on the venue", () => {
    assert.equal(
      domain(emptyVenueSetupSnapshot({ facebookUiState: "error" }), "facebook")?.state,
      "BLOCKED",
    );
    assert.equal(
      domain(emptyVenueSetupSnapshot({ facebookUiState: "needs_forms" }), "facebook")?.state,
      "WAITING_ON_VENUE",
    );
  });
});
