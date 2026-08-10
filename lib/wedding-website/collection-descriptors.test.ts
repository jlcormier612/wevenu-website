import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COLLECTION_DESCRIPTORS, collectionDescriptor } from "@/lib/wedding-website/collection-descriptors";

describe("collection descriptors", () => {
  it("Midnight uses the unified night-editorial descriptor (not Velvet language)", () => {
    assert.equal(
      COLLECTION_DESCRIPTORS.modern,
      "Cinematic night editorial — dark, dramatic, Vogue energy",
    );
    assert.notEqual(COLLECTION_DESCRIPTORS.modern, COLLECTION_DESCRIPTORS.velvet);
    assert.match(COLLECTION_DESCRIPTORS.modern ?? "", /dark|night/i);
  });

  it("Velvet uses the unified moody/candlelit descriptor (honest dark line)", () => {
    assert.equal(COLLECTION_DESCRIPTORS.velvet, "Dramatic, moody & candlelit");
    assert.match(COLLECTION_DESCRIPTORS.velvet ?? "", /moody|candlelit/i);
    assert.doesNotMatch(COLLECTION_DESCRIPTORS.velvet ?? "", /Met Gala|romantic soft/i);
  });

  it("falls back to catalog description when key unknown", () => {
    assert.equal(collectionDescriptor("unknown-key", "Fallback copy"), "Fallback copy");
  });
});
