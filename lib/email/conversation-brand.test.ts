import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUESTIONNAIRE_CTA_LABEL,
  isProposalOfferUrl,
  isQuestionnaireFormUrl,
  plainTextToEmailHtml,
  wrapConversationMessageHtml,
} from "@/lib/email/conversation-brand";
import { emailBrandFromVenue } from "@/lib/email/venue-brand";

const PROPOSAL_URL =
  "https://app.sandbox.hellotocheers.com/offer/592b46e0af7a3dadf21c98643c3f012ba3bee6fd5774af11";

describe("conversation email HTML linkifies proposal URLs", () => {
  it("detects /offer/{token} proposal URLs", () => {
    assert.equal(isProposalOfferUrl(PROPOSAL_URL), true);
    assert.equal(isProposalOfferUrl("https://example.com/leads/abc"), false);
  });

  it("HTML contains a real clickable View your proposal anchor", () => {
    const body = `Please find your proposal linked here: ${PROPOSAL_URL}`;
    const html = plainTextToEmailHtml(body);
    assert.match(
      html,
      new RegExp(
        `<a href="${PROPOSAL_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>View your proposal</a>`,
      ),
    );
    assert.match(html, /href="https:\/\/app\.sandbox\.hellotocheers\.com\/offer\//);
    assert.doesNotMatch(html, /href="javascript:/i);
  });

  it("proposal link points to the exact proposal URL", () => {
    const html = plainTextToEmailHtml(`See ${PROPOSAL_URL}`);
    const match = html.match(/<a href="([^"]+)"[^>]*>View your proposal<\/a>/);
    assert.ok(match);
    assert.equal(match![1], PROPOSAL_URL);
  });

  it("plain-text fallback path still carries the raw URL (caller keeps text field)", () => {
    // wrapConversationMessageHtml only builds HTML; plain text send keeps body as-is.
    const text = `Please find your proposal linked here: ${PROPOSAL_URL}`;
    assert.match(text, new RegExp(PROPOSAL_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const html = wrapConversationMessageHtml(
      emailBrandFromVenue({ name: "Jen's Fancy Venue", primaryColor: "#5D6F5D" }),
      text,
    );
    assert.match(html, /View your proposal/);
    assert.match(html, new RegExp(PROPOSAL_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("escapes script injection in surrounding text", () => {
    const html = plainTextToEmailHtml(`Hi <script>alert(1)</script>\n${PROPOSAL_URL}`);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /View your proposal/);
  });

  it("ordinary URLs become anchors without the proposal CTA label", () => {
    const html = plainTextToEmailHtml("Docs: https://example.com/guide");
    assert.match(html, /<a href="https:\/\/example\.com\/guide"/);
    assert.doesNotMatch(html, /View your proposal/);
    assert.doesNotMatch(html, new RegExp(QUESTIONNAIRE_CTA_LABEL));
  });
});

const QUESTIONNAIRE_URL =
  "https://app.sandbox.hellotocheers.com/questionnaire/592b46e0af7a3dadf21c98643c3f012ba3bee6fd";

describe("questionnaire email CTA", () => {
  it("detects /questionnaire/{accessKey} and leaves other paths as plain links", () => {
    assert.equal(isQuestionnaireFormUrl(QUESTIONNAIRE_URL), true);
    assert.equal(isQuestionnaireFormUrl("https://example.com/leads/abc"), false);
    assert.equal(isQuestionnaireFormUrl(PROPOSAL_URL), false);
  });

  it("renders exactly one Complete Your Questionnaire button with no separate visible raw URL", () => {
    const text = [
      "Hi Avery,",
      "",
      "Your Client Planning Questionnaire for Avery & Jordan is ready.",
      "",
      QUESTIONNAIRE_URL,
      "",
      "Everything goes directly to Jen's Fancy Venue — no PDFs, no attachments.",
      "",
      "Jen's Fancy Venue",
    ].join("\n");
    const html = wrapConversationMessageHtml(
      emailBrandFromVenue({ name: "Jen's Fancy Venue", primaryColor: "#5D6F5D" }),
      text,
    );
    const buttons = [
      ...html.matchAll(
        new RegExp(`<a href="([^"]+)"[^>]*>${QUESTIONNAIRE_CTA_LABEL}</a>`, "g"),
      ),
    ];
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0]![1], QUESTIONNAIRE_URL);
    // href attribute only — no separate visible raw-URL span/text under the button
    assert.doesNotMatch(
      html,
      /Complete Your Questionnaire<\/a>\s*<br><span[^>]*>https?:\/\//i,
    );
    const visibleBody = html
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(visibleBody, /\/questionnaire\/[A-Za-z0-9_-]+/);
    assert.match(html, /Jen&#39;s Fancy Venue|Jen's Fancy Venue/);
    assert.match(html, /Avery/);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.equal(QUESTIONNAIRE_CTA_LABEL, "Complete Your Questionnaire");
    // Plain-text body (caller keeps text field) still carries the destination URL.
    assert.match(text, new RegExp(QUESTIONNAIRE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});
