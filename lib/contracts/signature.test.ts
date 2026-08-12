import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";

import { deriveContractSigningUiState, CONTRACT_SIGNATURE_CONSENT_TEXT, hashContractContent } from "@/lib/contracts/signers";
import { wrapConversationMessageHtml, plainTextToEmailHtml } from "@/lib/email/conversation-brand";
import { resolvePdfBrandColors } from "@/lib/collateral/pdf-brand";

describe("contract signing UI labels", () => {
  it("shows Sign contract while draft and venue unsigned", () => {
    const r = deriveContractSigningUiState({
      status: "draft", venueSigned: false, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.label, "Sign contract");
  });

  it("shows Ready for client after venue signed", () => {
    const r = deriveContractSigningUiState({
      status: "draft", venueSigned: true, requiredClientTotal: 1, requiredClientSigned: 0, expiresAt: null,
    });
    assert.equal(r.label, "Ready for client");
  });

  it("shows awaiting client signature with count for two signers", () => {
    const r = deriveContractSigningUiState({
      status: "sent", venueSigned: true, requiredClientTotal: 2, requiredClientSigned: 1, expiresAt: null,
    });
    assert.equal(r.label, "Awaiting client signature (1 of 2)");
  });

  it("shows Fully signed when status is signed", () => {
    const r = deriveContractSigningUiState({
      status: "signed", venueSigned: true, requiredClientTotal: 2, requiredClientSigned: 2, expiresAt: null,
    });
    assert.equal(r.label, "Fully signed");
  });
});

describe("content hash", () => {
  it("matches node sha256 of content", () => {
    const content = "Agreement terms…\nLine 2";
    assert.equal(hashContractContent(content), createHash("sha256").update(content, "utf8").digest("hex"));
  });

  it("differs when content changes", () => {
    assert.notEqual(hashContractContent("A"), hashContractContent("B"));
  });
});

describe("consent text", () => {
  it("preserves factual consent language", () => {
    assert.match(CONTRACT_SIGNATURE_CONSENT_TEXT, /legal signature/);
  });
});

describe("conversation email branding", () => {
  it("wraps resolved body with venue brand and escapes html", () => {
    const html = wrapConversationMessageHtml(
      { name: "Sweet Daisy", logoUrl: null, primaryColor: "#112233" },
      "Hello {{should_already_be_resolved}}\n\nSecond <script>",
    );
    assert.match(html, /Sweet Daisy/);
    assert.match(html, /#112233/);
    assert.match(html, /Hello \{\{should_already_be_resolved\}\}/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /Hello to Cheers/i);
  });

  it("plainTextToEmailHtml preserves paragraphs", () => {
    const html = plainTextToEmailHtml("A\n\nB");
    assert.match(html, /<p/);
    assert.match(html, />A</);
    assert.match(html, />B</);
  });
});

describe("pdf brand colors", () => {
  it("falls back safely and exposes secondary/accent", () => {
    const c = resolvePdfBrandColors({
      primaryColor: "#111111",
      secondaryColor: "#222222",
      accentColor: "#333333",
      neutralColor: "#444444",
    });
    assert.equal(c.primary, "#111111");
    assert.equal(c.secondary, "#222222");
    assert.equal(c.accent, "#333333");
    assert.equal(c.neutral, "#444444");
  });
});
