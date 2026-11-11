import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WALKTHROUGH_PAGE } from "@/lib/marketing/walkthrough-page";

describe("WALKTHROUGH_PAGE approved copy", () => {
  it("locks the three-section creative specification", () => {
    assert.equal(WALKTHROUGH_PAGE.intro.eyebrow, "A CLOSER LOOK");
    assert.equal(WALKTHROUGH_PAGE.intro.headline, "Let's talk about your venue.");
    assert.equal(
      WALKTHROUGH_PAGE.intro.body,
      "Every venue has its own way of doing things. We'd love to learn about yours, show you around Hello to Cheers, and explore how everything could come together in one thoughtfully connected platform.",
    );
    assert.equal(
      WALKTHROUGH_PAGE.intro.closing,
      "A personal conversation, tailored to you.",
    );
    assert.equal(
      WALKTHROUGH_PAGE.intro.imageSrc,
      "/marketing/walkthrough-personal-conversation.jpg",
    );
    assert.equal(
      WALKTHROUGH_PAGE.intro.imageAlt,
      "Venue professional discussing event plans during a personalized video walkthrough.",
    );
    assert.equal(
      WALKTHROUGH_PAGE.booking.headline,
      "Find a time that works for you.",
    );
    assert.equal(
      WALKTHROUGH_PAGE.booking.body,
      "Choose a convenient time below, and we'll take care of the rest.",
    );
    assert.equal(
      WALKTHROUGH_PAGE.contactAlternative.headline,
      "Have a question first?",
    );
    assert.equal(
      WALKTHROUGH_PAGE.contactAlternative.body,
      "Not quite ready for a walkthrough? We'd be happy to hear from you.",
    );
    assert.equal(WALKTHROUGH_PAGE.contactAlternative.cta.href, "/contact");
    assert.equal(WALKTHROUGH_PAGE.contactAlternative.cta.label, "Get in Touch");
  });
});
