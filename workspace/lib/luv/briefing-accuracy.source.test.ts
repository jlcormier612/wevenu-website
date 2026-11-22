/**
 * Source contracts for Luv briefing accuracy (safe from repo-root tsx).
 * Runtime behavior covered by briefing-accuracy.test.ts via workspace tsconfig.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = join(process.cwd(), "workspace/lib/luv");

function read(name: string) {
  return readFileSync(join(root, name), "utf8");
}

describe("Luv briefing accuracy source contracts", () => {
  it("greeting uses America/New_York helper, not Date#getHours", () => {
    const briefing = read("briefing.ts");
    const tod = read("time-of-day.ts");
    assert.match(tod, /America\/New_York/);
    assert.match(tod, /hourCycle:\s*["']h23["']/);
    assert.match(briefing, /formatLuvGreeting/);
    assert.doesNotMatch(briefing, /now\.getHours\(/);
    assert.doesNotMatch(briefing, /deepen two relationships/i);
    assert.match(
      briefing,
      /You're ready for your first customer conversations/,
    );
  });

  it("loadLuvBriefing stays on operational CRM slice", () => {
    const load = read("load.ts");
    assert.match(load, /toOperationalWorkspaceData\(getData\(\)\)/);
  });

  it("client card refreshes greeting from shared helper", () => {
    const card = readFileSync(
      join(process.cwd(), "workspace/components/luv/luv-briefing.tsx"),
      "utf8",
    );
    assert.match(card, /formatLuvGreeting/);
    assert.match(card, /setInterval/);
    assert.match(card, /visibilitychange/);
  });
});
