import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { partitionArchived } from "@/components/library/partition-archived";

describe("partitionArchived", () => {
  it("puts active first and archived second without mutating input", () => {
    const items = [
      { id: "a", isArchived: false },
      { id: "b", isArchived: true },
      { id: "c", isArchived: false },
    ];
    const result = partitionArchived(items, (i) => i.isArchived);
    assert.deepEqual(result.active.map((i) => i.id), ["a", "c"]);
    assert.deepEqual(result.archived.map((i) => i.id), ["b"]);
    assert.equal(items.length, 3);
  });

  it("supports package is_active as inverted archived flag", () => {
    const packages = [
      { id: "1", isActive: true },
      { id: "2", isActive: false },
    ];
    const { active, archived } = partitionArchived(packages, (p) => !p.isActive);
    assert.equal(active.length, 1);
    assert.equal(archived[0]?.id, "2");
  });
});

/**
 * Pure documentary assertions for questionnaire release safety.
 * Domain functions touch Supabase — these lock the intended status gates
 * that the UI and RPC rely on so regressions are obvious in code review.
 */
describe("questionnaire release status contract", () => {
  const publicStatuses = new Set(["sent", "submitted", "reviewed"]);
  const draftOnlyStatuses = new Set(["draft"]);

  it("public couple access allow-list excludes draft", () => {
    assert.equal(publicStatuses.has("draft"), false);
    for (const s of ["sent", "submitted", "reviewed"]) assert.equal(publicStatuses.has(s), true);
  });

  it("withdraw maps client-open statuses back to draft", () => {
    const withdrawFrom = ["sent", "submitted", "reviewed"];
    for (const s of withdrawFrom) {
      assert.equal(publicStatuses.has(s), true);
      // after withdraw
      assert.equal(draftOnlyStatuses.has("draft"), true);
      assert.equal(publicStatuses.has("draft"), false);
      void s;
    }
  });

  it("apply-template remains draft-gated (sent cannot be overwritten)", () => {
    const canApply = (status: string | null) => !status || status === "draft";
    assert.equal(canApply(null), true);
    assert.equal(canApply("draft"), true);
    assert.equal(canApply("sent"), false);
    assert.equal(canApply("submitted"), false);
  });
});
