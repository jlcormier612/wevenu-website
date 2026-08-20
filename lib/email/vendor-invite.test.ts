import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVendorInviteHtml, buildVendorInviteText } from "@/lib/email/vendor-invite";

describe("vendor invite email", () => {
  const props = {
    vendorName: "Cuppity Cakes",
    venueName: "Jen's Fancy Venue",
    acceptUrl: "https://app.example.com/vendor/accept?token=abc",
  };

  it("leads with a warm connect message instead of system-notification framing", () => {
    const html = buildVendorInviteHtml(props);
    const text = buildVendorInviteText(props);

    assert.match(html, /Jen's Fancy Venue would love to connect with you on Hello to Cheers/);
    assert.match(text, /Jen's Fancy Venue would love to connect with you on Hello to Cheers/);
    assert.doesNotMatch(html, /has set up a vendor profile for/);
    assert.doesNotMatch(text, /has set up a vendor profile for/);
  });

  it("explains what claiming the profile unlocks", () => {
    const html = buildVendorInviteHtml(props);
    assert.match(html, /Keep your business information up to date/);
    assert.match(html, /Manage the services and packages you offer/);
    assert.match(html, /Share your availability with venues you work with/);
    assert.match(html, /It only takes a minute to get started/);
  });
});
