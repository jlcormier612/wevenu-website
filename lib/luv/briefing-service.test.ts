import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const briefing = readFileSync(resolve("lib/luv/briefing-service.ts"), "utf8");

describe("Daily Briefing payment attention", () => {
  it("loads payment schedules and passes schedule lines into payments readiness", () => {
    assert.match(briefing, /getSchedules/);
    assert.match(briefing, /getAllLineItems/);
    assert.match(briefing, /computePaymentsReadiness\(eventInvoices,\s*eventScheduleLines\)/);
    assert.doesNotMatch(
      briefing,
      /computePaymentsReadiness\(eventInvoices\)\s*;/,
    );
  });
});
