/**
 * Migration Center — the HoneyBook adapter, Phase 1 (safe baseline).
 * Verifies conservative, content-based recognition and that normalization
 * delegates entirely to genericCsvAdapter's own proven logic — no
 * source-specific intelligence yet (that's Phase 2).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { honeybookAdapter } from "@/lib/migration/sources/honeybook";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import { getSourceAdapter } from "@/lib/migration/source-profiles";

describe("honeybookAdapter.recognizes — conservative, content-based, no assumed header positions", () => {
  it("matches an explicit self-identifying label", () => {
    assert.equal(honeybookAdapter.recognizes(["Name", "Email", "Phone", "Address", "Exported from HoneyBook"]), true);
  });

  it("matches the verified field cluster: combined name + email + phone + address, no split name columns", () => {
    assert.equal(honeybookAdapter.recognizes(["Name", "Email", "Phone", "Address", "Notes", "Date Created"]), true);
    assert.equal(honeybookAdapter.recognizes(["Client Name", "Email", "Phone Number", "Address"]), true);
  });

  it("does not match when the file already has separate first/last name columns — that's not this source's verified shape", () => {
    assert.equal(honeybookAdapter.recognizes(["First Name", "Last Name", "Email", "Phone", "Address"]), false);
  });

  it("does not match an unrelated or incomplete header set — no over-eager guessing", () => {
    assert.equal(honeybookAdapter.recognizes(["Name", "Notes"]), false); // missing the email/phone/address cluster
    assert.equal(honeybookAdapter.recognizes(["First Name", "Last Name", "Email"]), false);
    assert.equal(honeybookAdapter.recognizes([]), false);
  });
});

describe("honeybookAdapter.normalizeRow — Phase 1 delegates entirely to generic CSV", () => {
  it("produces the same result as genericCsvAdapter for a client row with pre-split names", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", email: "jamie@example.com" };
    assert.deepEqual(honeybookAdapter.normalizeRow(row, "client"), genericCsvAdapter.normalizeRow(row, "client"));
  });

  it("produces the same result as genericCsvAdapter for a lead row", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", inquiryMessage: "Interested" };
    assert.deepEqual(honeybookAdapter.normalizeRow(row, "lead"), genericCsvAdapter.normalizeRow(row, "lead"));
  });

  it("produces the same result as genericCsvAdapter for a vendor row", () => {
    const row = { businessName: "Bloom & Co" };
    assert.deepEqual(honeybookAdapter.normalizeRow(row, "vendor"), genericCsvAdapter.normalizeRow(row, "vendor"));
  });
});

describe("source-profiles registry — HoneyBook wired in", () => {
  it("getSourceAdapter('honeybook') returns the real HoneyBook adapter, not the generic fallback", () => {
    assert.equal(getSourceAdapter("honeybook"), honeybookAdapter);
    assert.notEqual(getSourceAdapter("honeybook"), genericCsvAdapter);
  });
});
