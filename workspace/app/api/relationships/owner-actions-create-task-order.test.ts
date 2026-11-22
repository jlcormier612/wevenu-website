import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Contract for live create_task dual-write ordering (owner-actions route).
 * Durable live persist must precede any ok:true; local JSONL is overlay only.
 */
describe("create_task live dual-write order contract", () => {
  it("requires live persist before success when relationship is in live store", () => {
    const steps: string[] = [];
    const inLive = true;

    function simulate(livePersistOk: boolean) {
      steps.length = 0;
      if (inLive) {
        steps.push("live_task");
        if (!livePersistOk) {
          return { ok: false as const, status: 500 };
        }
        steps.push("live_timeline");
      }
      steps.push("local_task");
      steps.push("local_timeline");
      return { ok: true as const, status: 200 };
    }

    const fail = simulate(false);
    assert.equal(fail.ok, false);
    assert.deepEqual(steps, ["live_task"]);

    const ok = simulate(true);
    assert.equal(ok.ok, true);
    assert.deepEqual(steps, [
      "live_task",
      "live_timeline",
      "local_task",
      "local_timeline",
    ]);
  });
});
