import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVendorInviteHtml, buildVendorInviteText } from "@/lib/email/vendor-invite";

describe("vendor invite email", () => {
  const props = {
    vendorName: "Cuppity Cakes",
    venueName: "Jen's Fancy Venue",
    acceptUrl: "https://app.example.com/vendor/accept?token=abc",
  };

  it("leads with venue invitation framing and Claim CTA", () => {
    const html = buildVendorInviteHtml(props);
    const text = buildVendorInviteText(props);

    assert.match(html, /Invitation from Jen's Fancy Venue/);
    assert.match(html, /Jen's Fancy Venue has included you as one of the vendors they make available to couples/);
    assert.match(html, /Claim My Vendor Profile/);
    assert.match(text, /Jen's Fancy Venue has included you as one of the vendors they make available to couples/);
    assert.match(text, /Claim My Vendor Profile/);
    assert.doesNotMatch(html, /has set up a vendor profile for/);
    assert.doesNotMatch(text, /has set up a vendor profile for/);
  });

  it("explains what claiming the profile unlocks", () => {
    const html = buildVendorInviteHtml(props);
    assert.match(html, /Take ownership of your business information/);
    assert.match(html, /Share a richer profile with packages and FAQs/);
    assert.match(html, /Receive messages from couples who discover you/);
    assert.match(html, /Collaborate on events once you're selected/);
    assert.match(html, /It only takes a minute to get started/);
  });
});
