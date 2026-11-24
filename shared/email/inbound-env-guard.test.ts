import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  expectedInboundDomain,
  extractEmailDomain,
  inboundEventTargetsEnvironment,
} from "./inbound-env-guard";

describe("inbound-env-guard", () => {
  it("extracts domains from bare and angled addresses", () => {
    assert.equal(extractEmailDomain("inbox@replies.hellotocheers.com"), "replies.hellotocheers.com");
    assert.equal(
      extractEmailDomain("Name <relationship+abc@replies.hellotocheers.com>"),
      "replies.hellotocheers.com",
    );
  });

  it("parses RESEND_INBOUND_ADDRESS full or domain-only", () => {
    assert.equal(
      expectedInboundDomain("inbox@replies.hellotocheers.com"),
      "replies.hellotocheers.com",
    );
    assert.equal(
      expectedInboundDomain("replies.sandbox.hellotocheers.com"),
      "replies.sandbox.hellotocheers.com",
    );
    assert.equal(expectedInboundDomain(""), null);
    assert.equal(expectedInboundDomain(undefined), null);
    assert.equal(expectedInboundDomain("NONE"), null);
    assert.equal(expectedInboundDomain("none"), null);
  });

  it("fail-closes when inbound address is unset or placeholder", () => {
    for (const inboundAddress of ["", "NONE", "none", "n/a"]) {
      const r = inboundEventTargetsEnvironment({
        to: ["x@replies.hellotocheers.com"],
        inboundAddress,
      });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.reason, "inbound_address_unconfigured");
    }
  });

  it("fail-closes when event targets a different domain", () => {
    const r = inboundEventTargetsEnvironment({
      to: ["relationship+1@replies.sandbox.hellotocheers.com"],
      inboundAddress: "inbox@replies.hellotocheers.com",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "wrong_inbound_domain");
  });

  it("allows events for this environment domain via to or received_for", () => {
    const a = inboundEventTargetsEnvironment({
      to: ["relationship+abc@replies.hellotocheers.com"],
      inboundAddress: "inbox@replies.hellotocheers.com",
    });
    assert.equal(a.ok, true);

    const b = inboundEventTargetsEnvironment({
      to: [],
      receivedFor: ["inbox@replies.hellotocheers.com"],
      inboundAddress: "inbox@replies.hellotocheers.com",
    });
    assert.equal(b.ok, true);
  });
});
