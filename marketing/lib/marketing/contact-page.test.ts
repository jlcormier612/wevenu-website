import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CONTACT_PAGE } from "@/lib/marketing/contact-page";

describe("CONTACT_PAGE approved copy", () => {
  it("locks the Contact introduction, placeholder, and closing", () => {
    assert.equal(CONTACT_PAGE.intro.eyebrow, "LET'S CONNECT");
    assert.equal(CONTACT_PAGE.intro.headline, "We'd love to hear from you.");
    assert.equal(
      CONTACT_PAGE.intro.body,
      "Have a question about Hello to Cheers? Tell us a little about your venue and what's on your mind. We're happy to help.",
    );
    assert.equal(CONTACT_PAGE.form.messagePlaceholder, "How can we help?");
    assert.equal(CONTACT_PAGE.form.submitLabel, "Send Message");
    assert.equal(CONTACT_PAGE.closing.line, "We look forward to connecting.");
  });
});
