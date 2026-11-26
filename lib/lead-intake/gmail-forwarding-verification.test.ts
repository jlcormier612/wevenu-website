import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyGmailForwardingVerification,
  extractGmailConfirmationCode,
  senderAuthAcceptable,
  toCustomerView,
  validateGmailConfirmationUrl,
} from "@/lib/lead-intake/gmail-forwarding-verification";

const FIXTURE_LINK_ONLY = {
  from: "Gmail Forwarding Confirmation <forwarding-noreply@google.com>",
  subject: "Gmail Forwarding Confirmation - Receive Mail from jennifer@example.com",
  body: [
    "Please click the link below to confirm that you want to forward mail to this address.",
    "https://mail.google.com/mail/vf-abcdefghijklmnopqrstuvwxyz012345",
    "If you do not want to receive mail from this address, ignore this message.",
  ].join("\n"),
  headers: {
    "authentication-results": "mx.google.com; spf=pass smtp.mailfrom=google.com; dkim=pass; dmarc=pass",
  },
};

const FIXTURE_CODE_AND_LINK = {
  ...FIXTURE_LINK_ONLY,
  subject: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from jennifer@example.com",
};

describe("gmail forwarding verification classifier", () => {
  it("classifies allowlisted Google confirmation with link", () => {
    const classified = classifyGmailForwardingVerification(FIXTURE_LINK_ONLY);
    assert.ok(classified);
    assert.equal(classified!.confirmationCode, null);
    assert.match(classified!.confirmationUrl!, /^https:\/\/mail\.google\.com\//);
  });

  it("extracts confirmation code when present", () => {
    const classified = classifyGmailForwardingVerification(FIXTURE_CODE_AND_LINK);
    assert.ok(classified);
    assert.equal(classified!.confirmationCode, "123456789");
    assert.equal(extractGmailConfirmationCode(FIXTURE_CODE_AND_LINK.subject, ""), "123456789");
  });

  it("rejects non-allowlisted from even with matching subject", () => {
    const classified = classifyGmailForwardingVerification({
      ...FIXTURE_LINK_ONLY,
      from: "attacker@evil.example",
    });
    assert.equal(classified, null);
  });

  it("rejects when authentication-results hard-fail", () => {
    const classified = classifyGmailForwardingVerification({
      ...FIXTURE_LINK_ONLY,
      headers: { "authentication-results": "mx; spf=fail; dkim=fail; dmarc=fail" },
    });
    assert.equal(classified, null);
  });

  it("rejects arbitrary https links that are not Google confirmation hosts", () => {
    const classified = classifyGmailForwardingVerification({
      ...FIXTURE_LINK_ONLY,
      body: "Confirm at https://evil.example/phish",
    });
    assert.equal(classified, null);
  });

  it("validateGmailConfirmationUrl rejects http and unknown hosts", () => {
    assert.equal(validateGmailConfirmationUrl("http://mail.google.com/mail/vf-abc").ok, false);
    assert.equal(validateGmailConfirmationUrl("https://evil.example/mail/vf-abc").ok, false);
    assert.equal(validateGmailConfirmationUrl("https://mail.google.com/mail/vf-abc").ok, true);
  });

  it("validateGmailConfirmationUrl rejects nested off-host redirects", () => {
    const nested =
      "https://mail.google.com/mail/u/0/?continue=https://evil.example/steal";
    assert.equal(validateGmailConfirmationUrl(nested).ok, false);
  });

  it("senderAuthAcceptable requires allowlisted from", () => {
    assert.equal(
      senderAuthAcceptable({
        fromAllowlisted: false,
        spfPass: true,
        dkimPass: true,
        dmarcPass: true,
        authenticationResultsPresent: true,
        summary: "x",
      }),
      false,
    );
  });

  it("toCustomerView never treats opened as completed success", () => {
    const view = toCustomerView({
      id: "1",
      state: "opened",
      confirmation_url: "https://mail.google.com/mail/vf-abc",
      confirmation_code: null,
      expires_at: null,
      received_at: new Date().toISOString(),
    });
    assert.equal(view?.display, "opened");
  });

  it("toCustomerView hides acknowledged records", () => {
    assert.equal(
      toCustomerView({
        id: "1",
        state: "acknowledged",
        confirmation_url: "https://mail.google.com/mail/vf-abc",
        confirmation_code: null,
        expires_at: null,
        received_at: new Date().toISOString(),
      }),
      null,
    );
  });
});

describe("gmail forwarding verification wiring", () => {
  it("email intake classifies before extractInquiryFromEmail", () => {
    const route = readFileSync(resolve("app/api/leads/email-intake/route.ts"), "utf8");
    assert.match(route, /classifyGmailForwardingVerification/);
    const classifyAt = route.indexOf("classifyGmailForwardingVerification({");
    const extractAt = route.indexOf("await extractInquiryFromEmail(");
    assert.ok(classifyAt > 0, "missing classify call");
    assert.ok(extractAt > 0, "missing extract call");
    assert.ok(classifyAt < extractAt, "classify must run before extract");
  });

  it("open redirect re-validates URL and never logs secrets", () => {
    const open = readFileSync(
      resolve("app/api/settings/gmail-forwarding-verification/[id]/open/route.ts"),
      "utf8",
    );
    assert.match(open, /validateGmailConfirmationUrl/);
    assert.doesNotMatch(open, /confirmation_url\}/);
    assert.doesNotMatch(open, /console\.(log|info|warn|error)\([^\)]*confirmation/);
  });

  it("Help article includes Completing Google's verification section", () => {
    const articles = readFileSync(resolve("lib/help-guides/integration-setup-articles.ts"), "utf8");
    assert.match(articles, /Completing Google's verification in Hello to Cheers/);
    assert.match(articles, /Confirm forwarding with Google/);
  });
});
