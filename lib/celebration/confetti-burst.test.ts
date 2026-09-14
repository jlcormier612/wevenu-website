import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  CELEBRATION_CONFETTI_LAYER_MS,
  CELEBRATION_CONFETTI_TOTAL_PIECES,
} from "@/lib/celebration/confetti-burst";

const BURST = resolve("lib/celebration/confetti-burst.ts");
const CELEBRATE_LUV = resolve("lib/luv/celebrate.ts");
const CELEBRATE_TASK = resolve("lib/portal/celebrate-task.ts");

/** Call sites that must use celebrateLuv for verified domain milestones. */
const LUV_CALL_SITES = [
  "components/portal/vendor-section.tsx",
  "components/portal/seating-section.tsx",
  "components/portal/timeline-section.tsx",
  "components/portal/finalize-guest-count-card.tsx",
  "components/portal/website-editor.tsx",
  "components/portal/couple-documents-section.tsx",
  "components/form/couple-questionnaire-form.tsx",
  "components/form/couple-family-questionnaire-form.tsx",
  "app/sign/[token]/sign-form.tsx",
  "components/payments/payment-schedule-detail.tsx",
] as const;

describe("canonical celebration confetti contract", () => {
  const burst = readFileSync(BURST, "utf8");
  const luv = readFileSync(CELEBRATE_LUV, "utf8");
  const task = readFileSync(CELEBRATE_TASK, "utf8");

  it("defines a center triple-burst with enough pieces and duration to read as celebration", () => {
    assert.equal(CELEBRATION_CONFETTI_TOTAL_PIECES, 120);
    assert.ok(CELEBRATION_CONFETTI_LAYER_MS >= 2000);
    assert.match(burst, /innerHeight \* 0\.42/);
    assert.match(burst, /spawnBurst\(layer, \{ x: cx, y: cy \}, 48/);
    assert.match(burst, /setTimeout\(\(\) => \{\s*spawnBurst\(layer, \{ x: cx - 48/);
    assert.match(burst, /setTimeout\(\(\) => \{\s*spawnBurst\(layer, \{ x: cx \+ 48/);
    assert.match(burst, /document\.body\.appendChild\(layer\)/);
    assert.match(burst, /z-index:2147483000/);
    assert.doesNotMatch(burst, /top:-10px/);
    assert.doesNotMatch(burst, /pieceCount = 24/);
  });

  it("celebrateLuv uses the shared burst — not a separate top trickle", () => {
    assert.match(luv, /fireCelebrationConfetti/);
    assert.match(luv, /toast\.success/);
    assert.doesNotMatch(luv, /luv-confetti-fall/);
    assert.doesNotMatch(luv, /pieceCount/);
  });

  it("celebrateTaskComplete uses the same shared burst", () => {
    assert.match(task, /fireCelebrationConfetti/);
    assert.match(task, /toast\.success/);
  });

  it("layer is not removed immediately after spawn", () => {
    assert.match(burst, /CELEBRATION_CONFETTI_LAYER_MS|2200/);
    assert.match(burst, /layer\.remove\(\)/);
    const removeAt = burst.indexOf("layer.remove()");
    const appendAt = burst.indexOf("document.body.appendChild(layer)");
    assert.ok(appendAt >= 0 && removeAt > appendAt);
  });
});

describe("verified celebration call sites still fire celebrateLuv", () => {
  for (const file of LUV_CALL_SITES) {
    it(`${file} invokes celebrateLuv`, () => {
      const src = readFileSync(resolve(file), "utf8");
      assert.match(src, /celebrateLuv\(/);
      assert.match(src, /from "@\/lib\/luv\/celebrate"/);
    });
  }

  it("vendor list submit gates confetti on celebrated === true", () => {
    const src = readFileSync(resolve("components/portal/vendor-section.tsx"), "utf8");
    assert.match(src, /if \(data\.celebrated\)/);
    assert.match(src, /vendor_list_submitted/);
  });

  it("unified tasks use celebrateTaskComplete, not celebrateLuv", () => {
    const src = readFileSync(resolve("components/portal/unified-tasks-section.tsx"), "utf8");
    assert.match(src, /celebrateTaskComplete\(/);
    assert.doesNotMatch(src, /celebrateLuv\(/);
  });

  it("venue staff task list stays toast-only (no confetti burst)", () => {
    const src = readFileSync(resolve("components/playbooks/event-task-list.tsx"), "utf8");
    assert.match(src, /function celebrateCompletion/);
    assert.doesNotMatch(src, /fireCelebrationConfetti|celebrateLuv|celebrateTaskComplete/);
  });
});
