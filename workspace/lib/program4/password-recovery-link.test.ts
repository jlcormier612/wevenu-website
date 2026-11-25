import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { workspacePasswordRecoveryUrl } from "./password-recovery-link";

describe("workspacePasswordRecoveryUrl", () => {
  it("builds Production reset URL with token_hash and type=recovery", () => {
    const url = workspacePasswordRecoveryUrl({
      workspaceOrigin: "https://workspace.hellotocheers.com",
      hashedToken: "abc.def",
    });
    assert.equal(
      url,
      "https://workspace.hellotocheers.com/login/reset?token_hash=abc.def&type=recovery",
    );
  });

  it("never embeds localhost", () => {
    const url = workspacePasswordRecoveryUrl({
      workspaceOrigin: "https://workspace.hellotocheers.com/",
      hashedToken: "tok",
    });
    assert.doesNotMatch(url, /localhost/i);
  });
});
