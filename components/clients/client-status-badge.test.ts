import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clientStatusBadgeKind } from "@/components/clients/client-status-badge";

describe("clientStatusBadgeKind", () => {
  it("does not label planning / unbooked contacts as Booked", () => {
    assert.equal(
      clientStatusBadgeKind({ clientStatus: "planning", membershipKind: null }),
      "contact",
    );
    assert.equal(
      clientStatusBadgeKind({ clientStatus: "booking", membershipKind: null }),
      "contact",
    );
  });

  it("labels authoritative booked membership as Booked or Past", () => {
    assert.equal(
      clientStatusBadgeKind({ clientStatus: "planning", membershipKind: "current" }),
      "booked",
    );
    assert.equal(
      clientStatusBadgeKind({ clientStatus: "planning", membershipKind: "past" }),
      "past",
    );
  });

  it("keeps Cancelled for cancelled contacts even if membership is present", () => {
    assert.equal(
      clientStatusBadgeKind({ clientStatus: "cancelled", membershipKind: "current" }),
      "cancelled",
    );
  });
});
