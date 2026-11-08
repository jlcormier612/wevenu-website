import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { paymentReminderTemplate } from "./definitions.ts";

describe("payment reminder Phase 2 lifecycle comms gate", () => {
  const vars = {
    firstName: "Jen",
    venueName: "Fancy Venue",
    dunningDay: 14,
    accessEndsAt: "2026-12-01T00:00:00.000Z",
    billingPortalUrl: "https://billing.example/test",
  };

  it("omits three-sided and client/vendor notice claims by default", () => {
    delete process.env.HTC_PHASE2_LIFECYCLE_COMMS;
    const rendered = paymentReminderTemplate.render(vars);
    assert.equal(/wedding websites/i.test(rendered.text), false);
    assert.equal(/clients and vendors who sign in/i.test(rendered.text), false);
    assert.equal(/in-app notices will begin/i.test(rendered.text), false);
    assert.match(rendered.text, /venue workspace will be suspended/i);
  });

  it("includes prepared Phase 2 claims only when explicitly enabled", () => {
    process.env.HTC_PHASE2_LIFECYCLE_COMMS = "true";
    const rendered = paymentReminderTemplate.render(vars);
    assert.match(rendered.text, /wedding websites/i);
    assert.match(rendered.text, /clients and vendors who sign in/i);
    delete process.env.HTC_PHASE2_LIFECYCLE_COMMS;
  });
});
