/**
 * Starter Venue Guide FAQs — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isFaqPublished, resolveFaqsForAudience } from "@/lib/venue-guide/audience";
import {
  FAQ_STARTER_MASTERS,
  faqEntryFromMaster,
  getFaqStarterMaster,
  shouldSkipFaqStarterProvision,
} from "@/lib/venue-guide/starters";

const APPROVED: { key: string; question: string; answer: string }[] = [
  {
    key: "FAQ-01",
    question: "What is included with our venue rental?",
    answer:
      "Your venue rental includes the spaces, furnishings, and services listed in your selected package. Review your package details for everything included with your event, and ask our team if you're unsure whether something is included.",
  },
  {
    key: "FAQ-02",
    question: "Can we tour the venue before booking?",
    answer:
      "Absolutely! We recommend touring the venue so you can see the spaces, ask questions, and get a feel for how your celebration could come together. Contact our team to schedule a tour.",
  },
  {
    key: "FAQ-03",
    question: "How far in advance should we book our wedding?",
    answer:
      "Popular wedding dates can book well in advance, especially during peak wedding seasons. If you have a specific date in mind, we recommend reaching out as early as possible. Our team can let you know which dates are currently available.",
  },
  {
    key: "FAQ-04",
    question: "Can we have both our ceremony and reception at the venue?",
    answer:
      "Many couples choose to host both their ceremony and reception with us. Depending on your venue and package, different spaces or layouts may be available for each part of the celebration. Ask our team about the options for your event.",
  },
  {
    key: "FAQ-05",
    question: "What happens if we want to change our guest count?",
    answer:
      "We understand that guest counts can change as your plans come together. Your final guest count helps us prepare your event, seating, and other details. Let us know when your guest list changes so we can confirm any updates that may affect your event.",
  },
  {
    key: "FAQ-06",
    question: "Can we choose our own vendors?",
    answer:
      "Vendor policies vary by venue and by service. Some venues offer a preferred vendor list, while others allow couples to bring in their own vendors. We'll let you know which options apply to your event and package.",
  },
  {
    key: "FAQ-07",
    question: "When should we finalize our event details?",
    answer:
      "We'll work with you throughout the planning process to gather the details we need for your celebration. As your event approaches, we'll confirm important information such as guest count, layout, timeline, vendors, and other event-day details.",
  },
  {
    key: "FAQ-08",
    question: "Can we customize the layout for our event?",
    answer:
      "Absolutely. Your floor plan can be customized to fit the way you'd like your celebration to flow. Depending on your venue's layout and the options available, you can work with our team to arrange seating and other event details.",
  },
  {
    key: "FAQ-09",
    question: "When will we receive our final event details?",
    answer:
      "We'll gather your final event information as your celebration approaches and confirm the details with you before the big day. Your event team will let you know when it's time to review and finalize your plans.",
  },
  {
    key: "FAQ-10",
    question: "What time can we arrive to set up?",
    answer:
      "Your available setup and access times depend on your event, package, and venue schedule. We'll confirm your access window with you as part of the event planning process.",
  },
  {
    key: "FAQ-11",
    question: "What should we bring with us on the wedding day?",
    answer:
      "This depends on your package and the plans you've made for your event. Your team will help you understand what the venue provides and what you'll need to bring, including any personal décor, specialty items, or other details you've chosen for your celebration.",
  },
  {
    key: "FAQ-12",
    question: "What happens after our wedding?",
    answer:
      "Once your celebration is over, we'll help wrap up any remaining venue details and make sure you know about anything that still needs your attention. We'd also love to hear about your experience and see your favorite memories from the day.",
  },
];

const UNSAFE = [
  /\bcancel/i,
  /\brefund/i,
  /\binsurance\b/i,
  /\balcohol\b/i,
  /\bcater/i,
  /\bADA\b/,
  /\bliabilit/i,
  /\bindemnif/i,
  /\bgratuity\b/i,
  /\bminimum spend\b/i,
  /\bservice charge\b/i,
  /\bcurfew\b/i,
  /\bnoise ordinance\b/i,
];

describe("Starter FAQ masters", () => {
  it("ships exactly FAQ-01…FAQ-12 in order with exact approved Q/A", () => {
    assert.equal(FAQ_STARTER_MASTERS.length, 12);
    for (let i = 0; i < APPROVED.length; i++) {
      const master = FAQ_STARTER_MASTERS[i]!;
      const expected = APPROVED[i]!;
      assert.equal(master.key, expected.key);
      assert.equal(master.sortOrder, i);
      assert.equal(master.question, expected.question);
      assert.equal(master.answer, expected.answer);
      assert.equal(getFaqStarterMaster(expected.key)?.question, expected.question);
    }
  });

  it("avoids cancellation, insurance, alcohol, catering, legal, and fee claims", () => {
    for (const master of FAQ_STARTER_MASTERS) {
      const blob = `${master.question}\n${master.answer}`;
      for (const pat of UNSAFE) {
        assert.doesNotMatch(blob, pat, `${master.key}`);
      }
    }
  });

  it("seeds unpublished Hello to Cheers starter entries", () => {
    const entry = faqEntryFromMaster(FAQ_STARTER_MASTERS[0]!);
    assert.equal(entry.source_master_key, "FAQ-01");
    assert.equal(entry.published, false);
    assert.equal(isFaqPublished(entry), false);
    assert.equal(entry.audience, "both");
  });
});

describe("FAQ starter provision skip rules", () => {
  it("skips when source_master_key already exists (idempotent)", () => {
    assert.equal(
      shouldSkipFaqStarterProvision({
        masterKey: "FAQ-01",
        masterQuestion: APPROVED[0]!.question,
        existingByKey: new Set(["FAQ-01"]),
        existingQuestions: new Set(),
      }),
      "skip_key",
    );
  });

  it("skips same-question customized FAQs (never overwrite)", () => {
    assert.equal(
      shouldSkipFaqStarterProvision({
        masterKey: "FAQ-01",
        masterQuestion: APPROVED[0]!.question,
        existingByKey: new Set(),
        existingQuestions: new Set([APPROVED[0]!.question]),
      }),
      "skip_question",
    );
  });

  it("creates when key and question are free", () => {
    assert.equal(
      shouldSkipFaqStarterProvision({
        masterKey: "FAQ-02",
        masterQuestion: APPROVED[1]!.question,
        existingByKey: new Set(["FAQ-01"]),
        existingQuestions: new Set([APPROVED[0]!.question]),
      }),
      "create",
    );
  });
});

describe("FAQ publish defaults for outbound surfaces", () => {
  it("treats missing published as live (legacy venue-authored FAQs)", () => {
    assert.equal(isFaqPublished({ question: "Q", answer: "A" }), true);
    assert.equal(isFaqPublished({ question: "Q", answer: "A", published: true }), true);
    assert.equal(isFaqPublished({ question: "Q", answer: "A", published: false }), false);
  });

  it("hides unpublished starters from audience projection; keeps published ones", () => {
    const faqs = [
      { question: "Legacy?", answer: "Yes" },
      faqEntryFromMaster(FAQ_STARTER_MASTERS[0]!),
      { ...faqEntryFromMaster(FAQ_STARTER_MASTERS[1]!), published: true as const },
    ];
    const clients = resolveFaqsForAudience(faqs, "clients");
    assert.deepEqual(
      clients.map((f) => f.question),
      ["Legacy?", APPROVED[1]!.question],
    );
  });
});
