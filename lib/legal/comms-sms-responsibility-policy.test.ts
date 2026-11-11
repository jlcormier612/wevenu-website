/**
 * Policy copy — customer communications / SMS responsibility boundary.
 * Source: marketing/lib/marketing/legal.ts (public marketing legal pages).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
} from "../../marketing/lib/marketing/legal";

const legalSrc = readFileSync(
  resolve("marketing/lib/marketing/legal.ts"),
  "utf8",
);

describe("Customer communications / SMS responsibility policy", () => {
  it("VSA includes Customer Communications and Messaging with venue responsibility + HTC product boundary", () => {
    const section = TERMS_OF_SERVICE.sections.find(
      (s) => s.heading === "9. Customer Communications and Messaging",
    );
    assert.ok(section);
    const body = (section!.paragraphs ?? []).join("\n");
    assert.match(body, /Customers are responsible for the communications/);
    assert.match(body, /does not determine whether a customer's particular communication is lawful/);
    assert.match(body, /will not send text messages through the Service where the required SMS permission has not been recorded/);
    assert.match(body, /is not a determination by Hello to Cheers that you were legally entitled/);
    assert.doesNotMatch(body, /ensures compliance|legal advice|guarantees that/i);
    assert.doesNotMatch(body, /Twilio requires/i);
    assert.doesNotMatch(body, /communication_permissions|A2P|opted_in/);
  });

  it("Privacy describes messaging data processing without making HTC the legal decision-maker", () => {
    const section = PRIVACY_POLICY.sections.find(
      (s) => s.heading === "Text Messaging and Communication Information",
    );
    assert.ok(section);
    const body = (section!.paragraphs ?? []).join("\n");
    assert.match(body, /messaging service providers/);
    assert.match(body, /Text messaging is only enabled through Hello to Cheers where the required recipient permission has been recorded/);
    assert.match(body, /does not mean Hello to Cheers has determined that a venue was legally entitled/);
    assert.match(body, /optional box \(unchecked by default\)/);
    assert.doesNotMatch(body, /ensures that the venue has obtained legally valid consent/i);
    assert.doesNotMatch(body, /HTC determines whether you have consented/i);
    assert.doesNotMatch(body, /Twilio requires/i);
  });

  it("Privacy venue-role clarification stays within existing service-provider framing", () => {
    const section = PRIVACY_POLICY.sections.find(
      (s) => s.heading === "7. Customer Content and Venue Relationships",
    );
    assert.ok(section);
    const body = (section!.paragraphs ?? []).join("\n");
    assert.match(body, /on behalf of that venue/);
    assert.match(body, /venue remains responsible for the communications/);
  });

  it("End User Terms point at the updated Privacy messaging section title", () => {
    assert.match(
      legalSrc,
      /Text Messaging and Communication Information/,
    );
    assert.match(legalSrc, /Accepting these Terms is not SMS consent/);
  });
});
