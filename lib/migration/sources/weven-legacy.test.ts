/**
 * Migration Center — the Weven (legacy) adapter. Verifies exactly what
 * this adapter actually does (conservative header recognition + reused
 * generic normalization) and, just as importantly, that it does NOT
 * silently invent Weven-specific structure nowhere confirmed to exist —
 * see weven-legacy.ts's own doc comment for what's verified vs. not.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wevenLegacyAdapter } from "@/lib/migration/sources/weven-legacy";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import { getSourceAdapter } from "@/lib/migration/source-profiles";

describe("wevenLegacyAdapter.recognizes — conservative, non-speculative", () => {
  it("matches when a header literally contains 'weven'", () => {
    assert.equal(wevenLegacyAdapter.recognizes(["First Name", "Weven ID"]), true);
    assert.equal(wevenLegacyAdapter.recognizes(["Exported from Weven"]), true);
    assert.equal(wevenLegacyAdapter.recognizes(["weven_record_id"]), true);
  });

  it("does not match ordinary headers with no such label — no invented signature", () => {
    assert.equal(wevenLegacyAdapter.recognizes(["First Name", "Last Name", "Email"]), false);
    assert.equal(wevenLegacyAdapter.recognizes([]), false);
  });
});

describe("wevenLegacyAdapter.normalizeRow — reuses proven generic normalization exactly", () => {
  it("produces the same result as genericCsvAdapter for a client row, since no verified Weven-specific transform exists", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", email: "jamie@example.com", eventDate: "2024-05-10" };
    assert.deepEqual(wevenLegacyAdapter.normalizeRow(row, "client"), genericCsvAdapter.normalizeRow(row, "client"));
  });

  it("produces the same result as genericCsvAdapter for a lead row", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", inquiryMessage: "Interested in a June date" };
    assert.deepEqual(wevenLegacyAdapter.normalizeRow(row, "lead"), genericCsvAdapter.normalizeRow(row, "lead"));
  });

  it("produces the same result as genericCsvAdapter for a vendor row", () => {
    const row = { businessName: "Bloom & Co", email: "hi@bloom.com" };
    assert.deepEqual(wevenLegacyAdapter.normalizeRow(row, "vendor"), genericCsvAdapter.normalizeRow(row, "vendor"));
  });

  it("surfaces the same explicit, human-reviewable error for an unmappable row — never a silent guess or a throw", () => {
    const result = wevenLegacyAdapter.normalizeRow({ email: "no-name@example.com" }, "client");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /first and last name/i);
  });

  it("preserves a source id, when present, the same way generic CSV does — safe for repeat-import idempotency", () => {
    const result = wevenLegacyAdapter.normalizeRow({ firstName: "Jamie", lastName: "Rivera", sourceId: "ext-42" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.normalized.sourceId, "ext-42");
  });
});

describe("source-profiles registry — Weven wired in, not silently falling back to generic", () => {
  it("getSourceAdapter('weven_legacy') returns the real Weven adapter, not the generic fallback", () => {
    assert.equal(getSourceAdapter("weven_legacy"), wevenLegacyAdapter);
    assert.notEqual(getSourceAdapter("weven_legacy"), genericCsvAdapter);
  });

  it("sources with no adapter yet still correctly fall back to generic", () => {
    assert.equal(getSourceAdapter("planning_pod"), genericCsvAdapter);
    assert.equal(getSourceAdapter("honeybook"), genericCsvAdapter);
  });
});
