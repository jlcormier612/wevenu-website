import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { venuePasswordRecoveryUrl } from "./password-recovery-link";

describe("venuePasswordRecoveryUrl", () => {
  it("builds Production auth/confirm URL with token_hash", () => {
    const url = venuePasswordRecoveryUrl({
      appOrigin: "https://app.hellotocheers.com",
      hashedToken: "abc.def",
    });
    const u = new URL(url);
    assert.equal(u.origin, "https://app.hellotocheers.com");
    assert.equal(u.pathname, "/auth/confirm");
    assert.equal(u.searchParams.get("token_hash"), "abc.def");
    assert.equal(u.searchParams.get("type"), "recovery");
    assert.equal(u.searchParams.get("next"), "/reset-password");
    assert.doesNotMatch(url, /localhost/i);
  });
});
