import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatSessionOutcomeSentence, summarizeSessionAccounting } from "@/lib/migration/session-accounting";

const empty = {
  parsed: 0, normalized: 0, validated: 0, duplicate_exact: 0, duplicate_likely: 0,
  conflict: 0, needs_review: 0, approved: 0, rejected: 0, committed: 0, skipped: 0,
};

describe("session outcome accounting copy", () => {
  it("names intentional exclusions distinctly from already-in-HTC skips", () => {
    const counts = { ...empty, committed: 2, rejected: 1, skipped: 1 };
    const sentence = formatSessionOutcomeSentence(counts);
    assert.match(sentence, /2 imported/);
    assert.match(sentence, /1 already in Hello to Cheers/);
    assert.match(sentence, /1 intentionally excluded/);
    assert.doesNotMatch(sentence, /skipped by you/);
    assert.equal(summarizeSessionAccounting(counts).intentionallyExcluded, 1);
  });

  it("does not imply completion while records still need attention", () => {
    const counts = { ...empty, committed: 1, needs_review: 1 };
    const sentence = formatSessionOutcomeSentence(counts);
    assert.match(sentence, /1 needs attention/);
    assert.match(sentence, /1 imported/);
  });
});
