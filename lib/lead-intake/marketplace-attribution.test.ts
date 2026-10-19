/**
 * Marketplace attribution + source-key normalization (Phase 1A).
 * Synthetic messages only — never treated as genuine provider evidence.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveLeadSourceKey, sourceLabel } from "@/lib/leads/constants";
import {
  buildEmailIntakeSourceData,
  classifyMarketplaceAttribution,
  emailIntakeLeadSourceKey,
  normalizeMarketplaceSourceKey,
  selectInboundEmailHeaders,
} from "@/lib/lead-intake/marketplace-attribution";

describe("normalizeMarketplaceSourceKey", () => {
  it("maps legacy weddingwire onto wedding_wire", () => {
    assert.equal(normalizeMarketplaceSourceKey("weddingwire"), "wedding_wire");
    assert.equal(normalizeMarketplaceSourceKey("Wedding Wire"), "wedding_wire");
    assert.equal(normalizeMarketplaceSourceKey("wedding_wire"), "wedding_wire");
  });

  it("maps the four marketplace brands", () => {
    assert.equal(normalizeMarketplaceSourceKey("The Knot"), "the_knot");
    assert.equal(normalizeMarketplaceSourceKey("zola"), "zola");
    assert.equal(normalizeMarketplaceSourceKey("Here Comes The Guide"), "here_comes_the_guide");
    assert.equal(normalizeMarketplaceSourceKey("hctg"), "here_comes_the_guide");
  });

  it("returns null for unknown values", () => {
    assert.equal(normalizeMarketplaceSourceKey("instagram"), null);
    assert.equal(normalizeMarketplaceSourceKey(""), null);
    assert.equal(normalizeMarketplaceSourceKey(null), null);
  });
});

describe("resolveLeadSourceKey marketplace aliases", () => {
  it("normalizes weddingwire and displays WeddingWire", () => {
    assert.deepEqual(resolveLeadSourceKey("weddingwire"), { key: "wedding_wire", originalLabel: null });
    assert.equal(sourceLabel("weddingwire"), "WeddingWire");
    assert.equal(sourceLabel("wedding_wire"), "WeddingWire");
  });

  it("resolves Zola and Here Comes the Guide", () => {
    assert.deepEqual(resolveLeadSourceKey("Zola"), { key: "zola", originalLabel: null });
    assert.deepEqual(resolveLeadSourceKey("Here Comes the Guide"), {
      key: "here_comes_the_guide",
      originalLabel: null,
    });
  });
});

describe("classifyMarketplaceAttribution", () => {
  it("does not fabricate attribution from From / subject alone (synthetic)", () => {
    const result = classifyMarketplaceAttribution({
      from: "The Knot <notifications@example-knot.test>",
      subject: "New inquiry from The Knot — Alex & Jordan",
      body: "You have a new inquiry on The Knot.",
      headers: { "message-id": "<synthetic-1@example.test>" },
    });
    assert.equal(result.marketplaceSource, null);
    assert.equal(result.ingestionMethod, "email_forward");
    assert.ok(result.evidenceNotes.includes("marketplace_unattributed"));
    assert.equal(emailIntakeLeadSourceKey(result), "email_parsed_generic");
  });

  it("accepts an explicit trusted marketplace key", () => {
    const result = classifyMarketplaceAttribution({
      from: "anything@example.com",
      subject: "hello",
      trustedMarketplaceKey: "weddingwire",
    });
    assert.equal(result.marketplaceSource, "wedding_wire");
    assert.equal(emailIntakeLeadSourceKey(result), "wedding_wire");
    assert.ok(result.evidenceNotes.some((n) => n.startsWith("trusted_key:")));
  });

  it("preserves email metadata in source_data without inventing marketplace", () => {
    const attribution = classifyMarketplaceAttribution({
      from: "venue-inquiry@example.test",
      subject: "Wedding inquiry",
    });
    const sourceData = buildEmailIntakeSourceData({
      attribution,
      emailId: "email_synthetic_1",
      from: "venue-inquiry@example.test",
      subject: "Wedding inquiry",
      headers: {
        "message-id": "<mid@example.test>",
        "x-spam-score": "0.1",
        "reply-to": "couple@example.test",
      },
      priorSourceData: { extracted_subject: "Wedding inquiry" },
    });
    assert.equal(sourceData.ingestion_method, "email_forward");
    assert.equal(sourceData.marketplace_source, null);
    assert.equal(sourceData.inbound_email_id, "email_synthetic_1");
    assert.deepEqual(sourceData.inbound_headers, {
      "message-id": "<mid@example.test>",
      "reply-to": "couple@example.test",
    });
  });
});

describe("selectInboundEmailHeaders", () => {
  it("keeps only the troubleshooting subset", () => {
    assert.deepEqual(
      selectInboundEmailHeaders({
        "message-id": "<a>",
        "list-id": "vendor",
        "x-noise": "drop",
      }),
      { "message-id": "<a>", "list-id": "vendor" },
    );
  });
});
