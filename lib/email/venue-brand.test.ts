import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendEmailSignatureText,
  emailBrandFromVenue,
  renderBrandedEmailHtml,
} from "@/lib/email/venue-brand";

describe("email brand signature", () => {
  it("appends signature and contact to plain text", () => {
    const out = appendEmailSignatureText("Hello client", {
      name: "Willow Estate",
      emailSignature: "Warmly,\nWillow Estate",
      replyContact: "hello@willow.test",
    });
    assert.match(out, /Hello client/);
    assert.match(out, /Warmly,/);
    assert.match(out, /hello@willow\.test/);
  });

  it("includes signature in branded HTML footer", () => {
    const brand = emailBrandFromVenue({
      name: "Willow Estate",
      primaryColor: "#5D6F5D",
      emailSignature: "See you soon",
      email: "hello@willow.test",
    });
    const html = renderBrandedEmailHtml(brand, "<p>Body</p>");
    assert.match(html, /See you soon/);
    assert.match(html, /hello@willow\.test/);
    assert.match(html, /Willow Estate/);
  });

  it("does not invent SMS branding fields", () => {
    const brand = emailBrandFromVenue({ name: "Willow", emailSignature: "Sig" });
    assert.equal(brand.emailSignature, "Sig");
    // SMS identity is platform from-number — signature is email-only.
    assert.ok(!("smsLogo" in brand));
  });
});
