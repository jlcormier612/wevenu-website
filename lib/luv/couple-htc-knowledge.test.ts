/**
 * Phase 1 — Couple HTC knowledge projection + Ask Luv retrieval.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FINAL_HELP_ARTICLES, PUBLISHABLE_HELP_ARTICLES } from "@/lib/help-guides/final-articles";
import { buildCoupleAskLuvSystemPrompt } from "@/lib/luv/couple-ask-prompt";
import {
  classifyAllHelpArticlesForCouple,
  formatCoupleHtcKnowledgeForPrompt,
  listCoupleSafeHtcKnowledge,
  projectHelpArticleForCouple,
  retrieveCoupleHtcKnowledge,
} from "@/lib/luv/couple-htc-knowledge";

describe("couple HTC knowledge — projection", () => {
  it("selects couple-safe HTC knowledge and excludes staff-only bodies", () => {
    const safe = listCoupleSafeHtcKnowledge();
    assert.ok(safe.length >= 12);
    assert.ok(safe.every((h) => h.source === "htc_product"));
    assert.ok(safe.every((h) => h.audience === "couple"));
    assert.ok(safe.every((h) => h.body.trim().length > 0));

    // Staff Settings paths must never appear in couple projections.
    for (const hit of safe) {
      assert.doesNotMatch(hit.body, /Your Venue → Settings/);
      assert.doesNotMatch(hit.body, /Task Center is where your venue team/);
      assert.doesNotMatch(hit.body, /success_library/i);
    }

    const staffOnly = classifyAllHelpArticlesForCouple().filter((c) => c.classification === "staff-only");
    assert.ok(staffOnly.length > 10);
    for (const row of staffOnly) {
      const article = FINAL_HELP_ARTICLES.find((a) => a.slug === row.slug)!;
      assert.equal(projectHelpArticleForCouple(article), null);
    }
  });

  it("keeps staff publishable set unchanged (couple-only excluded)", () => {
    assert.equal(PUBLISHABLE_HELP_ARTICLES.length, 35);
    assert.ok(PUBLISHABLE_HELP_ARTICLES.every((a) => (a.audience ?? "staff") !== "couple"));
  });

  it("classifies adaptable staff articles as requires-projection", () => {
    const rows = classifyAllHelpArticlesForCouple();
    const contract = rows.find((r) => r.slug === "who-signs-a-contract-first-and-what-happens-after");
    assert.ok(contract);
    assert.equal(contract.classification, "requires-projection");
    const projected = projectHelpArticleForCouple(
      FINAL_HELP_ARTICLES.find((a) => a.slug === contract.slug)!,
    );
    assert.ok(projected);
    assert.match(projected.body, /you sign first/i);
    assert.doesNotMatch(projected.body, /When you create a contract/);
  });
});

describe("couple HTC knowledge — retrieval", () => {
  it("grounds a contract how-to question in the HTC source", () => {
    const hits = retrieveCoupleHtcKnowledge("How do I sign my contract?");
    assert.ok(hits.length > 0);
    assert.ok(
      hits.some(
        (h) =>
          h.slug === "couple-review-sign-contract" ||
          h.slug === "who-signs-a-contract-first-and-what-happens-after",
      ),
    );
    assert.ok(hits.every((h) => h.source === "htc_product" && h.audience === "couple"));
    assert.match(hits[0]!.body, /sign/i);
  });

  it("grounds questionnaire and Choices how-tos in HTC source", () => {
    const qHits = retrieveCoupleHtcKnowledge("How do I submit a questionnaire?");
    assert.ok(qHits.some((h) => h.slug.includes("questionnaire")));
    assert.match(qHits.map((h) => h.body).join("\n"), /questionnaire/i);

    const cHits = retrieveCoupleHtcKnowledge("How do I complete Your Choices?");
    assert.ok(cHits.some((h) => h.slug.includes("choices")));
    assert.match(cHits.map((h) => h.body).join("\n"), /Your Choices/);
    assert.match(cHits.map((h) => h.body).join("\n"), /not a payment/i);
  });

  it("does not retrieve staff-only content for couple questions", () => {
    const hits = retrieveCoupleHtcKnowledge("How do I set my tour availability?");
    for (const hit of hits) {
      assert.doesNotMatch(hit.body, /Availability & Capacity/);
      assert.doesNotMatch(hit.body, /Your Venue → Settings/);
    }
    // Tour availability is staff-only — either no hits or only unrelated couple hits without staff Settings copy.
    const tourStaff = FINAL_HELP_ARTICLES.find((a) => a.slug === "how-do-i-set-my-tour-availability")!;
    assert.equal(projectHelpArticleForCouple(tourStaff), null);
  });

  it("returns empty retrieval for unknown HTC capabilities (no filler required)", () => {
    const hits = retrieveCoupleHtcKnowledge(
      "Does Hello to Cheers automatically book my honeymoon flights?",
    );
    assert.equal(hits.length, 0);
    const formatted = formatCoupleHtcKnowledgeForPrompt(hits);
    assert.match(formatted, /No matching Hello to Cheers how-to articles/);
    assert.match(formatted, /Do not invent product capabilities/);
    assert.doesNotMatch(formatted, /Typically, couples/);
    assert.doesNotMatch(formatted, /honeymoon/);
  });
});

describe("Ask Luv prompt layering", () => {
  it("receives HTC product knowledge distinctly from Venue Guide knowledge", () => {
    const htcHits = retrieveCoupleHtcKnowledge("How do I sign my contract?");
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm and clear.",
      htcHits,
      venueInfo: {
        policies: "No sparklers outdoors.",
        parkingInfo: "Guest lot on Oak Street.",
        faqs: [{ question: "Can we have candles?", answer: "Yes, LED only." }],
      },
    });

    const htcIdx = prompt.indexOf("--- HTC PRODUCT KNOWLEDGE ---");
    const venueIdx = prompt.indexOf("--- VENUE KNOWLEDGE ---");
    const portalIdx = prompt.indexOf("--- CURRENT PORTAL CONTEXT ---");
    const unknownIdx = prompt.indexOf("--- UNKNOWN ---");
    assert.ok(htcIdx > 0 && venueIdx > htcIdx && portalIdx > venueIdx && unknownIdx > portalIdx);

    assert.match(prompt, /source: htc_product/);
    assert.match(prompt, /source: venue_guide/);
    assert.match(prompt, /No sparklers outdoors/);
    assert.match(prompt, /sign/i);
    assert.match(prompt, /status: not_provided_in_phase_1/);
    assert.match(prompt, /Never say "Typically, couples/);
    assert.match(prompt, /available HTC guidance does not cover/);

    // Staff Settings path from can-couples-pay-online staff body must not leak
    // when retrieving a contract question.
    assert.doesNotMatch(prompt, /Financials & Integrations/);
  });

  it("keeps venue-only answers out of the HTC layer when no HTC match", () => {
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm and clear.",
      htcHits: [],
      venueInfo: { rainPlan: "Ceremony moves under the pavilion." },
    });
    assert.match(prompt, /No matching Hello to Cheers how-to articles/);
    assert.match(prompt, /Ceremony moves under the pavilion/);
  });
});
