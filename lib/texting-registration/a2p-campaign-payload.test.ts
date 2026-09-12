import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  A2P_CAMPAIGN_DESCRIPTION,
  A2P_CAMPAIGN_MESSAGE_FREQUENCY,
  A2P_CAMPAIGN_OPT_IN_KEYWORDS,
  A2P_CAMPAIGN_PRIVACY_POLICY_PARAM,
  A2P_CAMPAIGN_SUPPORT_EMAIL,
  A2P_CAMPAIGN_TERMS_PARAM,
  HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
  HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL,
  HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
  assertA2pCampaignPackageClean,
  assertA2pCampaignPayloadHasPolicyUrls,
  buildA2pCampaignCreateFields,
  buildA2pCampaignHelpMessage,
  buildA2pCampaignMessageFlow,
  requireA2pCampaignPolicyUrls,
} from "@/lib/texting-registration/a2p-campaign-payload";

const QUICKCLOUD_PRIVACY = "https://www.quickcloud.co/privacy";
const QUICKCLOUD_TERMS = "https://www.quickcloud.co/terms";

describe("A2P Campaign payload (no Twilio calls)", () => {
  it("fails closed when PrivacyPolicyUrl or TermsAndConditionsUrl are missing", () => {
    assert.throws(() =>
      requireA2pCampaignPolicyUrls({
        privacyPolicyUrl: null,
        termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
      }),
    );
    assert.throws(() =>
      requireA2pCampaignPolicyUrls({
        privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
        termsUrl: "",
      }),
    );
  });

  it("fails closed when a policy URL is not https", () => {
    assert.throws(() =>
      requireA2pCampaignPolicyUrls({
        privacyPolicyUrl: "http://hellotocheers.com/privacy",
        termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
      }),
    );
  });

  it("fails closed when a policy URL points at QuickCloud", () => {
    assert.throws(
      () =>
        requireA2pCampaignPolicyUrls({
          privacyPolicyUrl: QUICKCLOUD_PRIVACY,
          termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
        }),
      /not QuickCloud/i,
    );
    assert.throws(
      () =>
        requireA2pCampaignPolicyUrls({
          privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
          termsUrl: QUICKCLOUD_TERMS,
        }),
      /not QuickCloud/i,
    );
  });

  it("fails closed when Terms URL is the venue subscription /terms page", () => {
    assert.throws(() =>
      requireA2pCampaignPolicyUrls({
        privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
        termsUrl: "https://hellotocheers.com/terms",
      }),
    );
  });

  it("fails closed when a policy URL is otherwise invalid", () => {
    assert.throws(() =>
      requireA2pCampaignPolicyUrls({
        privacyPolicyUrl: "not-a-url",
        termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
      }),
    );
  });

  it("MessageFlow states voluntary optional consent and public evidence", () => {
    const flow = buildA2pCampaignMessageFlow({
      brandName: "QuickCloud LLC",
      privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
      termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
    });
    assert.match(flow, /Providing a phone number alone is not SMS consent/i);
    assert.match(flow, /preferred communication method is not SMS consent/i);
    assert.match(flow, /unchecked by default/i);
    assert.match(flow, /optional and voluntary/i);
    assert.match(flow, /submit an inquiry without agreeing to text messages/i);
    assert.match(flow, /book a tour without agreeing to text messages/i);
    assert.match(flow, /not a condition of using the service/i);
    assert.match(flow, /Reply STOP to opt out/i);
    assert.match(flow, /reply START to opt back in/i);
    assert.match(flow, /reply HELP for help/i);
    assert.match(flow, /Ordinary inbound text replies/i);
    assert.match(flow, /Message and data rates may apply/i);
    assert.match(flow, /not a fixed daily volume/i);
    assert.ok(flow.includes(HELLO_TO_CHEERS_PRIVACY_POLICY_URL));
    assert.ok(flow.includes(HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL));
    assert.ok(flow.includes(HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL));
    assert.doesNotMatch(flow, /quickcloud\.co/i);
    assert.doesNotMatch(flow, /help@quickcloud/i);
    assert.ok(flow.length <= 2048);
  });

  it("create fields always include HTC URLs, keywords, and clean support contact", () => {
    const fields = buildA2pCampaignCreateFields({
      brandRegistrationSid: "BN6dd5457b78fc5a24380b3cd9ca72b045",
      brandName: "QuickCloud LLC",
      privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
      termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
    });
    assert.equal(fields[A2P_CAMPAIGN_PRIVACY_POLICY_PARAM], HELLO_TO_CHEERS_PRIVACY_POLICY_URL);
    assert.equal(fields[A2P_CAMPAIGN_TERMS_PARAM], HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL);
    assert.equal(fields.Description, A2P_CAMPAIGN_DESCRIPTION);
    assert.match(fields.MessageFlow, new RegExp(A2P_CAMPAIGN_MESSAGE_FREQUENCY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.deepEqual(fields.OptInKeywords, [...A2P_CAMPAIGN_OPT_IN_KEYWORDS]);
    assert.ok(!fields.OptInKeywords.map((k) => k.toUpperCase()).includes("YES"));
    assert.match(fields.HelpMessage, new RegExp(A2P_CAMPAIGN_SUPPORT_EMAIL.replace(".", "\\.")));
    assert.doesNotMatch(fields.HelpMessage, /help@quickcloud/i);
    assert.doesNotMatch(fields.Description, /couples who opted in/i);
    assertA2pCampaignPayloadHasPolicyUrls(fields as unknown as Record<string, unknown>);
    assertA2pCampaignPackageClean(fields);
  });

  it("help message uses Hello to Cheers support email", () => {
    const msg = buildA2pCampaignHelpMessage("QuickCloud LLC");
    assert.match(msg, /privacy@hellotocheers\.com/);
    assert.doesNotMatch(msg, /quickcloud\.co/i);
  });

  it("rejects a payload map that omits policy URLs (guards the dogfood omission)", () => {
    assert.throws(() =>
      assertA2pCampaignPayloadHasPolicyUrls({
        BrandRegistrationSid: "BN_test",
        MessageFlow: "something long enough to look like a flow but missing urls",
      }),
    );
  });
});
