import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FEATURES_PAGE } from "@/lib/marketing/features-page";

describe("Features Signature Closing CTA", () => {
  it("keeps the approved Everything connected close — not Getting Started copy", () => {
    assert.equal(FEATURES_PAGE.close.headline, "Everything connected.");
    assert.deepEqual([...FEATURES_PAGE.close.body], [
      "No switching between disconnected systems.",
      "No duplicate entry.",
      "No wondering which version is correct.",
      "Just one calm workspace built around how venues actually operate.",
    ]);
    assert.equal(
      "actions" in FEATURES_PAGE.close,
      false,
      "Features close uses default Schedule + Request more information actions",
    );
  });
});
