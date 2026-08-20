/**
 * Migration Center — the HoneyBook adapter. Phase 1 coverage (recognition,
 * pre-split rows delegating to generic, registry wiring) plus Phase 2
 * coverage (combined-name splitting: two-part, three-part, longer,
 * single-word, empty, malformed/partial, and ambiguous-needs-review
 * cases) — "system proposes, human confirms uncertainty."
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { honeybookAdapter, splitName } from "@/lib/migration/sources/honeybook";
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

describe("honeybookAdapter.normalizeRow — a row that already has separate names defers entirely to generic CSV", () => {
  it("produces the same result as genericCsvAdapter for a client row with pre-split names", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", email: "jamie@example.com" };
    assert.deepEqual(honeybookAdapter.normalizeRow(row, "client"), genericCsvAdapter.normalizeRow(row, "client"));
  });

  it("produces the same result as genericCsvAdapter for a lead row", () => {
    const row = { firstName: "Jamie", lastName: "Rivera", inquiryMessage: "Interested" };
    assert.deepEqual(honeybookAdapter.normalizeRow(row, "lead"), genericCsvAdapter.normalizeRow(row, "lead"));
  });

  it("produces the same result as genericCsvAdapter for a vendor row — HoneyBook has no vendor-specific intelligence", () => {
    const row = { businessName: "Bloom & Co" };
    assert.deepEqual(honeybookAdapter.normalizeRow(row, "vendor"), genericCsvAdapter.normalizeRow(row, "vendor"));
  });
});

describe("splitName — Phase 2 best-effort combined-name split", () => {
  it("two-part names: normalizes normally, with confidence", () => {
    assert.deepEqual(splitName("Jamie Rivera"), { firstName: "Jamie", lastName: "Rivera", confident: true });
  });

  it("three-part names: a reasonable best-effort split, not treated as certain", () => {
    const result = splitName("Mary Jane Smith");
    assert.equal(result.firstName, "Mary");
    assert.equal(result.lastName, "Jane Smith");
    assert.equal(result.confident, false);
  });

  it("three-part names with a recognizable generational suffix ARE confident — a real, non-speculative pattern", () => {
    assert.deepEqual(splitName("John Smith Jr"), { firstName: "John", lastName: "Smith", confident: true });
    assert.deepEqual(splitName("John Smith Jr."), { firstName: "John", lastName: "Smith", confident: true });
    assert.deepEqual(splitName("Robert Jones III"), { firstName: "Robert", lastName: "Jones", confident: true });
  });

  it("longer (4+ part) names: still produces a proposal, never fails outright, but not confident", () => {
    const result = splitName("Anne Marie Von Der Berg");
    assert.equal(result.firstName, "Anne");
    assert.equal(result.lastName, "Marie Von Der Berg");
    assert.equal(result.confident, false);
  });

  it("a longer name ending in a suffix stays a real guess, not confident — the suffix pattern alone isn't enough once there's also a genuine multi-word middle/last name", () => {
    const result = splitName("Anne Marie Von Der Berg Jr");
    assert.equal(result.confident, false);
  });

  it("single-word names: preserves the available name, leaves last name empty, with confidence — no ambiguity in one word", () => {
    assert.deepEqual(splitName("Madonna"), { firstName: "Madonna", lastName: "", confident: true });
  });

  it("empty/whitespace-only names: never throws, reports low confidence rather than fabricating a name", () => {
    assert.deepEqual(splitName(""), { firstName: "", lastName: "", confident: false });
    assert.deepEqual(splitName("   "), { firstName: "", lastName: "", confident: false });
  });

  it("malformed spacing (tabs, doubled/irregular whitespace) is normalized before splitting", () => {
    assert.deepEqual(splitName("Jamie   \t Rivera"), { firstName: "Jamie", lastName: "Rivera", confident: true });
    assert.deepEqual(splitName("  Jamie Rivera  "), { firstName: "Jamie", lastName: "Rivera", confident: true });
  });
});

describe("honeybookAdapter.normalizeRow — Phase 2 combined-name splitting end to end", () => {
  it("a confident two-part split commits directly (ok:true)", () => {
    const result = honeybookAdapter.normalizeRow({ name: "Jamie Rivera", email: "jamie@example.com" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Jamie");
      assert.equal(result.normalized.lastName, "Rivera");
    }
  });

  it("also splits for lead rows, carrying lead-specific fields through", () => {
    const result = honeybookAdapter.normalizeRow({ name: "Jamie Rivera", inquiryMessage: "Interested in June" }, "lead");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Jamie");
      assert.equal((result.normalized as { inquiryMessage: string | null }).inquiryMessage, "Interested in June");
    }
  });

  it("an ambiguous (low-confidence) split surfaces through the existing needs_review path — never silently treated as certain", () => {
    const result = honeybookAdapter.normalizeRow({ name: "Mary Jane Smith", email: "mjs@example.com" }, "client");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Mary Jane Smith/);
      assert.match(result.error, /confirm/i);
    }
  });

  it("a single-word name still commits — no ambiguity, no unnecessary review burden on the venue", () => {
    const result = honeybookAdapter.normalizeRow({ name: "Madonna", email: "m@example.com" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Madonna");
      assert.equal(result.normalized.lastName, "");
    }
  });

  it("malformed/partial row — no name field, no email, nothing to go on — fails with a clear, human-readable reason, never a crash", () => {
    const result = honeybookAdapter.normalizeRow({ notes: "left a voicemail" }, "client");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /missing a name/i);
  });

  it("malformed/partial row — a whitespace-only name — treated as missing, not as an empty split", () => {
    const result = honeybookAdapter.normalizeRow({ name: "   ", email: "x@example.com" }, "client");
    assert.equal(result.ok, false);
  });

  it("recognizes 'Client Name' and 'Full Name' as the combined-name column, not just literal 'name'", () => {
    const r1 = honeybookAdapter.normalizeRow({ clientName: "Jamie Rivera" }, "client");
    const r2 = honeybookAdapter.normalizeRow({ fullName: "Jamie Rivera" }, "client");
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
  });

  it("a row with an already-split name takes precedence over any combined-name column, even if both are present", () => {
    const result = honeybookAdapter.normalizeRow({ firstName: "Jamie", lastName: "Rivera", name: "Someone Else Entirely" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.firstName, "Jamie");
      assert.equal(result.normalized.lastName, "Rivera");
    }
  });

  it("preserves a source id through the split path, for repeat-import idempotency", () => {
    const result = honeybookAdapter.normalizeRow({ name: "Jamie Rivera", sourceId: "hb-42" }, "client");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.normalized.sourceId, "hb-42");
  });
});

describe("source-profiles registry — HoneyBook wired in", () => {
  it("getSourceAdapter('honeybook') returns the real HoneyBook adapter, not the generic fallback", () => {
    assert.equal(getSourceAdapter("honeybook"), honeybookAdapter);
    assert.notEqual(getSourceAdapter("honeybook"), genericCsvAdapter);
  });
});
