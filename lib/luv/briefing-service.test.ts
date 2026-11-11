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

  it("exposes Focus-only needsAttentionNow path without briefing view write", () => {
    assert.match(briefing, /export async function getFocusNeedsAttentionBriefing/);
    const focusFn = briefing.slice(
      briefing.indexOf("export async function getFocusNeedsAttentionBriefing"),
      briefing.indexOf("export async function getDailyBriefing"),
    );
    assert.match(focusFn, /buildNeedsAttentionNow/);
    assert.doesNotMatch(focusFn, /luv_briefing_views/);
    assert.doesNotMatch(focusFn, /comingUpThisWeek\.push/);
    assert.doesNotMatch(focusFn, /luv_celebrations/);
  });

  it("Focus and full briefing share the same needsAttentionNow builder", () => {
    assert.match(briefing, /function buildNeedsAttentionNow/);
    assert.match(briefing, /getFocusNeedsAttentionBriefing/);
    assert.match(briefing, /getDailyBriefing/);
  });
});
