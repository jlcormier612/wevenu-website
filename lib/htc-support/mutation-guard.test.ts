import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { supportMutationBlocked } from "./mutation-guard.ts";

describe("Stage 1F support mutation gate", () => {
  it("allows GET in any mode", () => {
    assert.equal(
      supportMutationBlocked({
        method: "GET",
        pathname: "/api/leads",
        mode: "read",
      }).blocked,
      false,
    );
  });

  it("blocks mutations in read mode", () => {
    const gate = supportMutationBlocked({
      method: "POST",
      pathname: "/api/leads",
      mode: "read",
    });
    assert.equal(gate.blocked, true);
    assert.match(gate.reason || "", /read-only/i);
  });

  it("allows exit endpoints in read mode", () => {
    assert.equal(
      supportMutationBlocked({
        method: "POST",
        pathname: "/api/htc-support/exit",
        mode: "read",
      }).blocked,
      false,
    );
  });

  it("blocks customer-only financial paths in assist mode", () => {
    const gate = supportMutationBlocked({
      method: "POST",
      pathname: "/api/billing/subscribe",
      mode: "assist",
    });
    assert.equal(gate.blocked, true);
    assert.match(gate.reason || "", /customer-only/i);
  });

  it("allows ordinary setup mutations in assist mode", () => {
    assert.equal(
      supportMutationBlocked({
        method: "PATCH",
        pathname: "/api/venues/profile",
        mode: "assist",
      }).blocked,
      false,
    );
  });

  it("does nothing when no support mode cookie", () => {
    assert.equal(
      supportMutationBlocked({
        method: "DELETE",
        pathname: "/api/anything",
        mode: null,
      }).blocked,
      false,
    );
  });
});
