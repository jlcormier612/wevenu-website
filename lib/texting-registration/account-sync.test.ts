import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { VenueTwilioAccount } from "@/lib/sms/venue-twilio-config";
import { resolveTextingDisplayPhase } from "@/lib/texting-registration/account-sync";

const baseAccount = (overrides: Partial<VenueTwilioAccount> = {}): VenueTwilioAccount => ({
  venueId: "venue",
  twilioAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  messagingServiceSid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  defaultFromE164: null,
  phoneNumberSid: null,
  secondaryProfileSid: null,
  a2pBrandSid: null,
  a2pCampaignSid: null,
  status: "pending_compliance",
  statusDetail: null,
  ...overrides,
});

describe("resolveTextingDisplayPhase (self-service honesty)", () => {
  it("keeps information_saved when no venue Twilio account exists", () => {
    assert.equal(
      resolveTextingDisplayPhase("information_saved", null, false),
      "information_saved",
    );
  });

  it("does NOT map bare pending_compliance to under_review without Twilio evidence", () => {
    assert.equal(
      resolveTextingDisplayPhase("information_saved", baseAccount(), false),
      "information_saved",
    );
  });

  it("maps pending_compliance with Brand PENDING to under_review", () => {
    assert.equal(
      resolveTextingDisplayPhase(
        "information_saved",
        baseAccount({
          a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          a2pBrandStatus: "PENDING",
          complianceSubmittedAt: "2026-09-21T20:00:00Z",
        }),
        false,
        {
          a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          a2pBrandStatus: "PENDING",
          complianceSubmittedAt: "2026-09-21T20:00:00Z",
        },
      ),
      "under_review",
    );
  });

  it("maps ready account without sender to setting_up_number", () => {
    assert.equal(
      resolveTextingDisplayPhase(
        "information_saved",
        baseAccount({ status: "ready", defaultFromE164: null, phoneNumberSid: null }),
        false,
      ),
      "setting_up_number",
    );
  });

  it("maps genuinely sendable account to ready", () => {
    assert.equal(
      resolveTextingDisplayPhase(
        "information_saved",
        baseAccount({
          status: "ready",
          defaultFromE164: "+15551112222",
          phoneNumberSid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          a2pBrandSid: "BNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          a2pCampaignSid: "QEcccccccccccccccccccccccccccccccc",
          a2pBrandStatus: "APPROVED",
          a2pCampaignStatus: "VERIFIED",
        }),
        true,
      ),
      "ready",
    );
  });
});
