import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COLLECTION_DESCRIPTORS, collectionDescriptor } from "@/lib/wedding-website/collection-descriptors";

describe("collection descriptors", () => {
  it("Midnight uses the cinematic nocturnal descriptor (not Velvet language)", () => {
    assert.equal(COLLECTION_DESCRIPTORS.modern, "Cinematic, nocturnal & dramatic");
    assert.notEqual(COLLECTION_DESCRIPTORS.modern, COLLECTION_DESCRIPTORS.velvet);
    assert.match(COLLECTION_DESCRIPTORS.velvet ?? "", /moody|Dramatic/i);
  });

  it("falls back to catalog description when key unknown", () => {
    assert.equal(collectionDescriptor("unknown-key", "Fallback copy"), "Fallback copy");
  });
});
