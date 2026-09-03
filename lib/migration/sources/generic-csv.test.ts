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

  it("preserves end date, times, and space for Event fidelity", () => {
    const result = genericCsvAdapter.normalizeRow(
      {
        firstName: "Jamie", lastName: "Rivera",
        eventDate: "2027-06-12", endDate: "2027-06-13",
        startTime: "16:00", endTime: "22:00", setupTime: "14:00", teardownTime: "23:00",
        spaceName: "Ballroom",
      },
      "client",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.endDate, "2027-06-13");
      assert.equal(result.normalized.startTime, "16:00");
      assert.equal(result.normalized.endTime, "22:00");
      assert.equal(result.normalized.setupTime, "14:00");
      assert.equal(result.normalized.teardownTime, "23:00");
      assert.equal(result.normalized.spaceName, "Ballroom");
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

describe("genericCsvAdapter.normalizeRow — calendar / operational", () => {
  it("normalizes a recurring calendar block", () => {
    const result = genericCsvAdapter.normalizeRow(
      {
        title: "Closed Sundays", type: "blocked_time", startDate: "2026-01-04",
        recurrenceRule: "weekly", recurrenceEndsOn: "2026-12-27",
      },
      "calendar_block",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.recurrenceRule, "weekly");
      assert.equal(result.normalized.type, "blocked_time");
    }
  });

  it("normalizes a hold", () => {
    const result = genericCsvAdapter.normalizeRow(
      { title: "Soft hold — Rivera", holdDate: "2027-05-01", leadEmail: "jamie@example.com" },
      "date_hold",
    );
    assert.equal(result.ok, true);
  });

  it("normalizes a tour with lead email", () => {
    const result = genericCsvAdapter.normalizeRow(
      { scheduledAt: "2026-10-01T15:00:00Z", leadEmail: "jamie@example.com" },
      "tour",
    );
    assert.equal(result.ok, true);
  });

  it("requires client email for standalone events", () => {
    const missing = genericCsvAdapter.normalizeRow(
      { name: "Rivera Wedding", eventDate: "2027-06-12" },
      "event",
    );
    assert.equal(missing.ok, false);
  });
});

describe("genericCsvAdapter.normalizeRow — unsupported entity", () => {
  it("returns an explicit error for payment, never throws or silently drops", () => {
    const result = genericCsvAdapter.normalizeRow({ firstName: "x" }, "payment");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /payment/i);
  });

  it("returns an explicit error for document rows — artifacts, not live contracts", () => {
    const result = genericCsvAdapter.normalizeRow({ fileName: "contract.pdf" }, "document");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /artifact/i);
  });
});
