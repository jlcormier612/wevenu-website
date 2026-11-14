import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  enqueueOptionPersist,
  resetOptionPersistQueueForTests,
} from "@/lib/event-order-templates/option-persist-queue";

describe("template option persist queue", () => {
  it("starts each persist immediately so the first click's server action is not deferred", async () => {
    resetOptionPersistQueueForTests();
    const started: number[] = [];
    const finished: number[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolveGate) => {
      releaseFirst = resolveGate;
    });
    const first = enqueueOptionPersist(async () => {
      started.push(1);
      await firstGate;
      finished.push(1);
    });
    const second = enqueueOptionPersist(async () => {
      started.push(2);
      finished.push(2);
    });
    assert.deepEqual(started, [1, 2]);
    assert.deepEqual(finished, [2]);
    releaseFirst();
    await first;
    await second;
    assert.deepEqual(started, [1, 2]);
    assert.deepEqual(finished, [2, 1]);
  });

  it("template option Saves enqueue without startTransition wrapping the action", () => {
    const panel = readFileSync(
      resolve("components/event-order-templates/package-choices-panel.tsx"),
      "utf8",
    );
    const groups = readFileSync(
      resolve("components/event-order-templates/event-order-template-choice-groups.tsx"),
      "utf8",
    );
    assert.match(panel, /enqueueOptionPersist/);
    assert.match(panel, /saveOptionCommercial/);
    assert.match(panel, /pending=\{false\}/);
    assert.doesNotMatch(
      panel.slice(panel.indexOf("function saveOptionCommercial"), panel.indexOf("function removeChoiceSet")),
      /startTransition/,
    );
    assert.match(groups, /enqueueOptionPersist/);
    assert.match(groups, /persistOptionWrite/);
    const persistFn = groups.slice(
      groups.indexOf("function persistOptionWrite"),
      groups.indexOf("function renderGroupCard"),
    );
    assert.doesNotMatch(persistFn, /startTransition/);
  });
});
