import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";

describe("genericCsvAdapter.recognizes", () => {
  it("always matches — the deliberate fallback for every source without a real profile", () => {
    assert.equal(genericCsvAdapter.recognizes(["First Name", "Last Name"]), true);
    assert.equal(genericCsvAdapter.recognizes([]), true);
  });
});

describe("genericCsvAdapter.normalizeRow — client", () => {
  it("normalizes a complete row", () => {
    const result = genericCsvAdapter.normalizeRow(
      { firstName: " Jamie ", lastName: "Rivera", email: "jamie@example.com", eventDate: "2024-05-10", sourceId: "PP-123" },
      "client",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Jamie");
      assert.equal(result.normalized.email, "jamie@example.com");
      assert.equal(result.normalized.sourceId, "PP-123");
    }
  });

  it("rejects a row missing both names, without throwing", () => {
    const result = genericCsvAdapter.normalizeRow({ email: "no-name@example.com" }, "client");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /first and last name/i);
  });

  it("treats blank strings the same as missing", () => {
    const result = genericCsvAdapter.normalizeRow({ firstName: "   ", lastName: "Rivera" }, "client");
    assert.equal(result.ok, false);
  });
});

describe("genericCsvAdapter.normalizeRow — lead", () => {
  it("carries inquiry-specific fields a client row doesn't have", () => {
    const result = genericCsvAdapter.normalizeRow(
      { firstName: "Jamie", lastName: "Rivera", inquiryMessage: "Interested in June", estimatedBudget: "15000" },
      "lead",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.inquiryMessage, "Interested in June");
      assert.equal(result.normalized.estimatedBudget, "15000");
    }
  });
});

describe("genericCsvAdapter.normalizeRow — vendor", () => {
  it("requires a business name, not a person's name", () => {
    const missing = genericCsvAdapter.normalizeRow({ contactName: "Maria Chen" }, "vendor");
    assert.equal(missing.ok, false);

    const ok = genericCsvAdapter.normalizeRow({ businessName: "Bloom & Co", email: "hi@bloom.com" }, "vendor");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.normalized.businessName, "Bloom & Co");
  });
});

describe("genericCsvAdapter.normalizeRow — unsupported entity", () => {
  it("returns an explicit error, never throws or silently drops", () => {
    const result = genericCsvAdapter.normalizeRow({ firstName: "x" }, "event");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /event/i);
  });
});
