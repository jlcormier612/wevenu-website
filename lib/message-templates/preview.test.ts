import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SAMPLE_MERGE_VALUES, substituteSampleMergeFields } from "@/lib/message-templates/preview";

describe("substituteSampleMergeFields", () => {
  it("resolves first/last/full name sample tokens", () => {
    const out = substituteSampleMergeFields("Hi {{first_name}}, full: {{full_name}}");
    assert.equal(out, "Hi Sally, full: Sally Sunshine");
    assert.equal(SAMPLE_MERGE_VALUES.first_name, "Sally");
    assert.equal(SAMPLE_MERGE_VALUES.last_name, "Sunshine");
    assert.equal(SAMPLE_MERGE_VALUES.full_name, "Sally Sunshine");
  });
});
