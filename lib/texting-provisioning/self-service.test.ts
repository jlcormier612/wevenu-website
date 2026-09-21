/**
 * Texting self-service provisioning — unit tests for sequence, honesty, isolation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  JENS_FANCY_VENUE_ID,
  QUICKCLOUD_BRAND_SID,
  QUICKCLOUD_CAMPAIGN_SID,
  QUICKCLOUD_MESSAGING_SERVICE_SID,
  QUICKCLOUD_VENUE_ID,
  assertNotProtectedTwilioSid,
  assertVenueAllowedForSelfServiceProvisioning,
  isProtectedTextingVenueId,
  isProtectedTwilioSid,
} from "@/lib/sms/twilio-protected-resources";
import {
  isVenueTwilioSendReady,
  type VenueTwilioAccount,
} from "@/lib/sms/venue-twilio-config";
import {
  hasTwilioComplianceReviewEvidence,
  resolveTextingDisplayPhase,
} from "@/lib/texting-registration/account-sync";
import { TEXTING_PROVISIONING_STEPS } from "@/lib/texting-provisioning/steps";

const baseAccount = (overrides: Partial<VenueTwilioAccount> = {}): VenueTwilioAccount => ({
  venueId: "venue",
  twilioAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  messagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  defaultFromE164: null,
  phoneNumberSid: null,
  secondaryProfileSid: null,
  a2pBrandSid: null,
  a2pCampaignSid: null,
  a2pBrandStatus: null,
  a2pCampaignStatus: null,
  phoneA2pStatus: null,
  complianceSubmittedAt: null,
  status: "pending_compliance",
  statusDetail: null,
  ...overrides,
});

describe("protected Twilio resources", () => {
  it("blocks QuickCloud and Jen's Fancy venue ids", () => {
    assert.equal(isProtectedTextingVenueId(QUICKCLOUD_VENUE_ID), true);
    assert.equal(isProtectedTextingVenueId(JENS_FANCY_VENUE_ID), true);
    assert.throws(() => assertVenueAllowedForSelfServiceProvisioning(QUICKCLOUD_VENUE_ID));
    assert.throws(() => assertVenueAllowedForSelfServiceProvisioning(JENS_FANCY_VENUE_ID));
  });

  it("blocks known QuickCloud SIDs", () => {
    assert.equal(isProtectedTwilioSid(QUICKCLOUD_MESSAGING_SERVICE_SID), true);
    assert.equal(isProtectedTwilioSid(QUICKCLOUD_BRAND_SID), true);
    assert.equal(isProtectedTwilioSid(QUICKCLOUD_CAMPAIGN_SID), true);
    assert.throws(() => assertNotProtectedTwilioSid(QUICKCLOUD_BRAND_SID, "test"));
  });
});

describe("display phase honesty", () => {
  it("does not show Under review for bare pending_compliance without Twilio evidence", () => {
    const phase = resolveTextingDisplayPhase(
      "information_saved",
      baseAccount({ status: "pending_compliance" }),
      false,
    );
    assert.equal(phase, "information_saved");
    assert.notEqual(phase, "under_review");
  });

  it("shows Under review only with compliance submission evidence", () => {
    assert.equal(
      hasTwilioComplianceReviewEvidence({
        complianceSubmittedAt: "2026-09-21T20:00:00Z",
      }),
      true,
    );
    const phase = resolveTextingDisplayPhase(
      "information_saved",
      baseAccount({
        status: "pending_compliance",
        complianceSubmittedAt: "2026-09-21T20:00:00Z",
        a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        a2pBrandStatus: "PENDING",
      }),
      false,
      {
        complianceSubmittedAt: "2026-09-21T20:00:00Z",
        a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        a2pBrandStatus: "PENDING",
      },
    );
    assert.equal(phase, "under_review");
  });

  it("maps Campaign VERIFIED without phone to setting_up_number", () => {
    const phase = resolveTextingDisplayPhase(
      "under_review",
      baseAccount({
        status: "pending_compliance",
        a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        a2pBrandStatus: "APPROVED",
        a2pCampaignSid: "QEcccccccccccccccccccccccccccccccc",
        a2pCampaignStatus: "VERIFIED",
        complianceSubmittedAt: "2026-09-21T20:00:00Z",
      }),
      false,
      {
        a2pCampaignStatus: "VERIFIED",
        complianceSubmittedAt: "2026-09-21T20:00:00Z",
      },
    );
    assert.equal(phase, "setting_up_number");
  });

  it("maps Brand FAILED to needs_attention", () => {
    const phase = resolveTextingDisplayPhase(
      "under_review",
      baseAccount({
        a2pBrandStatus: "FAILED",
        a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
      false,
      { a2pBrandStatus: "FAILED", a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    );
    assert.equal(phase, "needs_attention");
  });
});

describe("ready gate", () => {
  it("requires ready status, brand, campaign, and sender", () => {
    assert.equal(
      isVenueTwilioSendReady(
        baseAccount({
          status: "pending_compliance",
          defaultFromE164: "+15551112222",
          phoneNumberSid: "PNdddddddddddddddddddddddddddddddd",
          a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          a2pCampaignSid: "QEcccccccccccccccccccccccccccccccc",
        }),
      ),
      false,
    );
    assert.equal(
      isVenueTwilioSendReady(
        baseAccount({
          status: "ready",
          defaultFromE164: "+15551112222",
          phoneNumberSid: "PNdddddddddddddddddddddddddddddddd",
        }),
      ),
      false,
    );
    assert.equal(
      isVenueTwilioSendReady(
        baseAccount({
          status: "ready",
          defaultFromE164: "+15551112222",
          phoneNumberSid: "PNdddddddddddddddddddddddddddddddd",
          a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          a2pCampaignSid: "QEcccccccccccccccccccccccccccccccc",
          a2pBrandStatus: "APPROVED",
          a2pCampaignStatus: "VERIFIED",
          phoneA2pStatus: "REGISTERED",
        }),
      ),
      true,
    );
  });

  it("fails closed when Brand status is present and not APPROVED", () => {
    assert.equal(
      isVenueTwilioSendReady(
        baseAccount({
          status: "ready",
          defaultFromE164: "+15551112222",
          phoneNumberSid: "PNdddddddddddddddddddddddddddddddd",
          a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          a2pCampaignSid: "QEcccccccccccccccccccccccccccccccc",
          a2pBrandStatus: "PENDING",
          a2pCampaignStatus: "VERIFIED",
        }),
      ),
      false,
    );
  });
});

describe("proven provisioning sequence", () => {
  it("creates Campaign after Brand approval and before phone purchase", () => {
    const brandIdx = TEXTING_PROVISIONING_STEPS.indexOf("await_brand_approved");
    const campaignIdx = TEXTING_PROVISIONING_STEPS.indexOf("submit_campaign");
    const campaignWaitIdx = TEXTING_PROVISIONING_STEPS.indexOf("await_campaign_verified");
    const buyIdx = TEXTING_PROVISIONING_STEPS.indexOf("buy_number");
    const attachIdx = TEXTING_PROVISIONING_STEPS.indexOf("attach_number");
    assert.ok(brandIdx >= 0);
    assert.ok(campaignIdx > brandIdx);
    assert.ok(campaignWaitIdx > campaignIdx);
    assert.ok(buyIdx > campaignWaitIdx);
    assert.ok(attachIdx > buyIdx);
  });
});
