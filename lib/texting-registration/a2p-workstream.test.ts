/**
 * A2P / SMS compliance product invariants (no Twilio calls).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { shouldRecordInquirySmsConsent } from "@/lib/communication/apply-inquiry-consent";
import {
  SMS_ALLOWS_NOT_OPTED_IN,
  isSmsOutboundAllowed,
  permissionFromTwilioOptOut,
} from "@/lib/communication/permissions";
import { effectivePublicCommunicationSettings } from "@/lib/communication/sms-consent";
import { buildA2pCampaignCreateFields, buildA2pCampaignMessageFlow } from "@/lib/texting-registration/a2p-campaign-payload";
import {
  HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
  HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL,
  HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
} from "@/lib/texting-registration/a2p-campaign-payload";

const root = process.cwd();

describe("A2P product invariants", () => {
  it("phone + unchecked box is not consent; outbound stays blocked", () => {
    assert.equal(shouldRecordInquirySmsConsent(false, "+16155551234"), false);
    assert.equal(SMS_ALLOWS_NOT_OPTED_IN, false);
    assert.equal(isSmsOutboundAllowed("not_opted_in"), false);
  });

  it("checked box + phone is consent; opted_in is the only sendable SMS state", () => {
    assert.equal(shouldRecordInquirySmsConsent(true, "+16155551234"), true);
    assert.equal(isSmsOutboundAllowed("opted_in"), true);
    assert.equal(isSmsOutboundAllowed("opted_out"), false);
    assert.equal(isSmsOutboundAllowed("provider_blocked"), false);
  });

  it("YES / casual inbound is never opt-in", () => {
    assert.equal(permissionFromTwilioOptOut(null, "yes"), null);
    assert.equal(permissionFromTwilioOptOut(null, "YES"), null);
    assert.equal(permissionFromTwilioOptOut(null, "Thanks!"), null);
  });

  it("hides SMS consent UI when the venue has no sender / SMS offer", () => {
    const off = effectivePublicCommunicationSettings({
      askPreferences: true,
      offerEmail: true,
      offerSms: true,
      offerPhoneCall: true,
      requestSmsPermission: true,
    }, false);
    assert.equal(off.showSmsPermission, false);
    assert.equal(off.offerSms, false);
  });

  it("sendSms is the only Twilio Messages.json caller and gates consent", () => {
    const send = readFileSync(path.join(root, "lib/sms/send.ts"), "utf8");
    assert.match(send, /assertChannelAllowed/);
    assert.match(send, /if \(!payload\.skipPermissionCheck\)/);
    const convo = readFileSync(path.join(root, "lib/conversations/service.ts"), "utf8");
    const scheduled = readFileSync(path.join(root, "lib/scheduled-messages/processor.ts"), "utf8");
    assert.doesNotMatch(convo, /skipPermissionCheck:\s*true/);
    assert.doesNotMatch(scheduled, /skipPermissionCheck:\s*true/);
    assert.match(convo, /sendSms\(/);
    assert.match(scheduled, /sendSms\(/);
  });

  it("42P10 fix matches venue_couple unique predicate", () => {
    const sql = readFileSync(
      path.join(root, "supabase/migrations/20261374000000_fix_provision_conversation_on_conflict.sql"),
      "utf8",
    );
    assert.match(sql, /on conflict \(relationship_id\)/);
    assert.match(sql, /conversation_kind = 'venue_couple'/);
    assert.match(sql, /do nothing/);
    assert.doesNotMatch(sql, /ON CONFLICT \(relationship_id\)\s+WHERE relationship_id IS NOT NULL\s+DO NOTHING/i);
  });

  it("public evidence page and Privacy SMS language match the Twilio package", () => {
    const evidence = readFileSync(path.join(root, "marketing/app/sms-opt-in/page.tsx"), "utf8");
    assert.match(evidence, /unchecked by default/i);
    assert.match(evidence, /not required/i);
    assert.match(evidence, /Reply STOP/i);
    assert.match(evidence, /START/i);
    assert.match(evidence, /HELP/i);
    assert.match(evidence, /privacy@hellotocheers\.com/);
    assert.match(evidence, /Message and data rates may apply/i);
    assert.doesNotMatch(evidence, /quickcloud\.co/i);
    assert.doesNotMatch(evidence, /QuickCloud LLC/);

    const legal = readFileSync(path.join(root, "marketing/lib/marketing/legal.ts"), "utf8");
    assert.match(legal, /optional box \(unchecked by default\)/);
    assert.match(legal, /You can submit an inquiry or book a tour without agreeing to text messages/);
    assert.match(legal, /Accepting these Terms is not SMS consent/);
    const smsBlock = legal.slice(legal.indexOf("Text Messages (Hello to Cheers)"));
    assert.doesNotMatch(smsBlock.slice(0, 2500), /operated by QuickCloud LLC/);

    const flow = buildA2pCampaignMessageFlow({
      brandName: "QuickCloud LLC",
      privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
      termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
    });
    assert.ok(flow.includes(HELLO_TO_CHEERS_SMS_OPT_IN_EVIDENCE_URL));
    assert.ok(flow.length <= 2048);
  });

  it("Twilio package never includes YES or QuickCloud legal URLs", () => {
    const fields = buildA2pCampaignCreateFields({
      brandRegistrationSid: "BN6dd5457b78fc5a24380b3cd9ca72b045",
      brandName: "QuickCloud LLC",
      privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
      termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
    });
    assert.ok(!fields.OptInKeywords.includes("YES"));
    assert.doesNotMatch(JSON.stringify(fields), /quickcloud\.co/i);
    assert.doesNotMatch(JSON.stringify(fields), /help@quickcloud/i);
  });
});
