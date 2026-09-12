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

describe("resolveTextingDisplayPhase (ops-first Track B)", () => {
  it("keeps information_saved when no venue Twilio account exists", () => {
    assert.equal(
      resolveTextingDisplayPhase("information_saved", null, false),
      "information_saved",
    );
  });

  it("maps pending_compliance account to under_review when details are saved", () => {
    assert.equal(
      resolveTextingDisplayPhase("information_saved", baseAccount(), false),
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
        }),
        true,
      ),
      "ready",
    );
  });
});
