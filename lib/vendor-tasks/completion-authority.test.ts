import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveCompletionAuthority } from "@/lib/vendor-tasks/completion-authority";

describe("deriveCompletionAuthority", () => {
  it("maps private → vendor_confirm regardless of action_type", () => {
    assert.equal(
      deriveCompletionAuthority({ coupleVisibility: "private", actionType: null }),
      "vendor_confirm",
    );
    assert.equal(
      deriveCompletionAuthority({
        coupleVisibility: "private",
        actionType: "share_timeline",
      }),
      "vendor_confirm",
    );
  });

  it("maps visible → vendor_confirm regardless of action_type", () => {
    assert.equal(
      deriveCompletionAuthority({ coupleVisibility: "visible", actionType: null }),
      "vendor_confirm",
    );
    assert.equal(
      deriveCompletionAuthority({
        coupleVisibility: "visible",
        actionType: "share_timeline",
      }),
      "vendor_confirm",
    );
  });

  it("maps owned + null action → couple_acknowledge", () => {
    assert.equal(
      deriveCompletionAuthority({ coupleVisibility: "owned", actionType: null }),
      "couple_acknowledge",
    );
    assert.equal(
      deriveCompletionAuthority({ coupleVisibility: "owned", actionType: undefined }),
      "couple_acknowledge",
    );
    assert.equal(
      deriveCompletionAuthority({ coupleVisibility: "owned", actionType: "other" }),
      "couple_acknowledge",
    );
  });

  it("maps owned + share_timeline → action_verified (only verified path)", () => {
    assert.equal(
      deriveCompletionAuthority({
        coupleVisibility: "owned",
        actionType: "share_timeline",
      }),
      "action_verified",
    );
  });
});
