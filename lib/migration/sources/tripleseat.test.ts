/**
 * Migration Center — the Tripleseat adapter (file-based Phase 1).
 * Verifies conservative recognition, the already-separate-name path
 * (Tripleseat's confirmed canonical shape), the confirmed Full_name
 * convenience path (reusing HoneyBook's own splitName — not a new
 * pattern), and that vendor/unsupported-entity rows get no
 * Tripleseat-specific behavior at all.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tripleseatAdapter } from "@/lib/migration/sources/tripleseat";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import { getSourceAdapter } from "@/lib/migration/source-profiles";

describe("tripleseatAdapter.recognizes — conservative, no over-broad matching", () => {
  it("matches an explicit self-identifying label", () => {
    assert.equal(tripleseatAdapter.recognizes(["First Name", "Last Name", "Exported from Tripleseat"]), true);
  });

  it("matches a Tripleseat-distinctive field (account_id/lead_source/contact_type) alongside a contact cluster", () => {
    assert.equal(tripleseatAdapter.recognizes(["first_name", "last_name", "email", "phone", "account_id"]), true);
    assert.equal(tripleseatAdapter.recognizes(["Full name", "Email", "Phone", "lead_source"]), true);
    assert.equal(tripleseatAdapter.recognizes(["Name", "Email", "Phone", "contact_type"]), true);
  });

  it("matches the confirmed Full_name convenience header alongside a contact cluster", () => {
    assert.equal(tripleseatAdapter.recognizes(["Full_name", "Email", "Phone"]), true);
  });

  it("does NOT match ordinary separate first/last name headers with no Tripleseat-distinctive signal — too broad otherwise", () => {
    assert.equal(tripleseatAdapter.recognizes(["First Name", "Last Name", "Email", "Phone"]), false);
  });

  it("does not match an unrelated or incomplete header set", () => {
    assert.equal(tripleseatAdapter.recognizes(["Name", "Notes"]), false);
    assert.equal(tripleseatAdapter.recognizes([]), false);
  });
});

describe("tripleseatAdapter.normalizeRow — already-separate names (Tripleseat's confirmed canonical shape) take precedence", () => {
  it("defers entirely to genericCsvAdapter for a client row with separate first/last names", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", email: "jamie@example.com" };
    assert.deepEqual(tripleseatAdapter.normalizeRow(row, "client"), genericCsvAdapter.normalizeRow(row, "client"));
  });

  it("defers entirely to genericCsvAdapter for a lead row with separate names", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", inquiryMessage: "Interested" };
    assert.deepEqual(tripleseatAdapter.normalizeRow(row, "lead"), genericCsvAdapter.normalizeRow(row, "lead"));
  });

  it("a row with separate names takes precedence even if a combined name column is also present", () => {
    const result = tripleseatAdapter.normalizeRow({ firstName: "Jamie", lastName: "Rivera", name: "Someone Else" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Jamie");
      assert.equal(result.normalized.lastName, "Rivera");
    }
  });
});

describe("tripleseatAdapter.normalizeRow — vendor and unsupported entities get no Tripleseat-specific handling", () => {
  it("vendor rows defer entirely to generic — no verified Account-as-vendor mapping", () => {
    const row = { businessName: "Bloom & Co" };
    assert.deepEqual(tripleseatAdapter.normalizeRow(row, "vendor"), genericCsvAdapter.normalizeRow(row, "vendor"));
  });

  it("event rows are explicitly not supported — Booking to Event migration is out of scope for this phase", () => {
    const result = tripleseatAdapter.normalizeRow({ name: "Some Event" }, "event");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /does not yet support/i);
  });
});

describe("tripleseatAdapter.normalizeRow — Full_name convenience path, reusing HoneyBook's splitName exactly", () => {
  it("a confident two-part combined name commits directly", () => {
    const result = tripleseatAdapter.normalizeRow({ name: "Jamie Rivera", email: "jamie@example.com" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Jamie");
      assert.equal(result.normalized.lastName, "Rivera");
    }
  });

  it("also splits for lead rows", () => {
    const result = tripleseatAdapter.normalizeRow({ name: "Jamie Rivera", inquiryMessage: "Interested" }, "lead");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal((result.normalized as { inquiryMessage: string | null }).inquiryMessage, "Interested");
  });

  it("an ambiguous (low-confidence) split routes to the existing needs_review path, never treated as certain", () => {
    const result = tripleseatAdapter.normalizeRow({ name: "Mary Jane Smith", email: "mjs@example.com" }, "client");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Mary Jane Smith/);
      assert.match(result.error, /confirm/i);
    }
  });

  it("a single-word combined name still commits — no unnecessary review burden", () => {
    const result = tripleseatAdapter.normalizeRow({ name: "Madonna", email: "m@example.com" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Madonna");
      assert.equal(result.normalized.lastName, "");
    }
  });

  it("recognizes 'fullName' as the combined-name column too, matching the field-mapping UI's existing slot", () => {
    const result = tripleseatAdapter.normalizeRow({ fullName: "Jamie Rivera" }, "client");
    assert.equal(result.ok, true);
  });
});

describe("tripleseatAdapter.normalizeRow — malformed/empty data", () => {
  it("no name field at all fails with a clear, human-readable reason, never a crash", () => {
    const result = tripleseatAdapter.normalizeRow({ notes: "left a voicemail" }, "client");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /missing a name/i);
  });

  it("a whitespace-only combined name is treated as missing, not as an empty split", () => {
    const result = tripleseatAdapter.normalizeRow({ name: "   ", email: "x@example.com" }, "client");
    assert.equal(result.ok, false);
  });

  it("whitespace-only separate first/last names are treated as not-already-split, falling through to the missing-name check", () => {
    const result = tripleseatAdapter.normalizeRow({ firstName: "   ", lastName: "  " }, "client");
    assert.equal(result.ok, false);
  });
});

describe("tripleseatAdapter.normalizeRow — source ID preservation", () => {
  it("preserves a source id through the already-split path", () => {
    const result = tripleseatAdapter.normalizeRow({ firstName: "Jamie", lastName: "Rivera", sourceId: "ts-123" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.normalized.sourceId, "ts-123");
  });

  it("preserves a source id through the combined-name split path", () => {
    const result = tripleseatAdapter.normalizeRow({ name: "Jamie Rivera", sourceId: "ts-456" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.normalized.sourceId, "ts-456");
  });
});

describe("source-profiles registry — Tripleseat wired in", () => {
  it("getSourceAdapter('tripleseat') returns the real Tripleseat adapter, not the generic fallback", () => {
    assert.equal(getSourceAdapter("tripleseat"), tripleseatAdapter);
    assert.notEqual(getSourceAdapter("tripleseat"), genericCsvAdapter);
  });
});
