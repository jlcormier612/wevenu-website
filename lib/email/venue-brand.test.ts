import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendEmailSignatureText,
  buildEmailFooterReplyContact,
  emailBrandFromVenue,
  renderBrandedEmailHtml,
  resolveEmailFooterContactPrefs,
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
    assert.doesNotMatch(html, /hello-to-cheers-logo-primary-transparent/);
    assert.doesNotMatch(html, /alt="Hello to Cheers"/);
  });

  it("does not invent SMS branding fields", () => {
    const brand = emailBrandFromVenue({ name: "Willow", emailSignature: "Sig" });
    assert.equal(brand.emailSignature, "Sig");
    // SMS identity is platform from-number — signature is email-only.
    assert.ok(!("smsLogo" in brand));
  });

  it("hides venue phone by default even when a phone is stored", () => {
    const prefs = resolveEmailFooterContactPrefs({
      email: "hello@fancy.test",
      phone: "9788703988",
    });
    assert.equal(prefs.showPhone, false);
    assert.equal(prefs.showEmail, true);
    assert.equal(prefs.showSignature, true);
    const brand = emailBrandFromVenue({
      name: "Jen's Fancy Venue",
      email: "hello@fancy.test",
      phone: "9788703988",
    });
    assert.equal(brand.replyContact, "hello@fancy.test");
    const html = renderBrandedEmailHtml(brand, "<p>Body</p>");
    assert.match(html, /hello@fancy\.test/);
    assert.doesNotMatch(html, /870-3988/);
  });

  it("formats venue phone in the contact line only when phone visibility is enabled", () => {
    const brand = emailBrandFromVenue({
      name: "Jen's Fancy Venue",
      email: "hello@fancy.test",
      phone: "9788703988",
      emailFooterShowPhone: true,
    });
    assert.equal(brand.replyContact, "hello@fancy.test · (978) 870-3988");
    const html = renderBrandedEmailHtml(brand, "<p>Body</p>");
    assert.match(html, /\(978\) 870-3988/);
    assert.doesNotMatch(html, />9788703988</);
  });

  it("omits disabled fields and empty separators entirely", () => {
    assert.equal(
      buildEmailFooterReplyContact({
        email: "hello@fancy.test",
        phone: "9788703988",
        emailFooterShowEmail: false,
        emailFooterShowPhone: true,
      }),
      "(978) 870-3988",
    );
    assert.equal(
      buildEmailFooterReplyContact({
        email: "hello@fancy.test",
        phone: "9788703988",
        emailFooterShowEmail: false,
        emailFooterShowPhone: false,
      }),
      null,
    );
    const brand = emailBrandFromVenue({
      name: "Willow",
      emailSignature: "Warmly,\nWillow",
      email: "hello@willow.test",
      phone: "5550100",
      emailFooterShowSignature: false,
      emailFooterShowEmail: false,
      emailFooterShowPhone: false,
    });
    assert.equal(brand.emailSignature, null);
    assert.equal(brand.replyContact, null);
    const html = renderBrandedEmailHtml(brand, "<p>Body</p>");
    assert.doesNotMatch(html, /Warmly/);
    assert.doesNotMatch(html, /hello@willow\.test/);
    assert.doesNotMatch(html, /555/);
    // No empty grey name-only footer row when everything is hidden.
    assert.doesNotMatch(html, /padding-top:20px;text-align:center/);
  });

  it("never invents a phone placeholder when phone is missing", () => {
    const brand = emailBrandFromVenue({
      name: "Willow",
      email: "hello@willow.test",
      phone: null,
      emailFooterShowPhone: true,
    });
    assert.equal(brand.replyContact, "hello@willow.test");
    assert.doesNotMatch(brand.replyContact ?? "", /Phone|null|undefined/i);
  });
});
