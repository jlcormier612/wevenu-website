/**
 * Sandbox/QA optional scope must not change the default cron path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("reminder process scope (sandbox isolation)", () => {
  it("cron route still invokes processors with no scope args", () => {
    const route = readFileSync("app/api/notifications/process/route.ts", "utf8");
    assert.match(route, /processReminders\(\)/);
    assert.match(route, /processObligationReminders\(\)/);
    assert.doesNotMatch(route, /processReminders\(\s*\{/);
    assert.doesNotMatch(route, /processObligationReminders\(\s*\{/);
  });

  it("engines apply reminderIds and venueId together", () => {
    const engine = readFileSync("lib/notifications/engine.ts", "utf8");
    const obligation = readFileSync("lib/notifications/obligation-engine.ts", "utf8");
    assert.match(engine, /applyReminderScope\(query, scope\)/);
    assert.match(obligation, /applyReminderScope\(query, scope\)/);
    assert.doesNotMatch(engine, /else if \(scope\?\.venueId\)/);
    assert.doesNotMatch(obligation, /else if \(scope\?\.venueId\)/);
  });
});
