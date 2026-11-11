/**
 * Targeted typography recovery — task meta / chips not stuck at 10px.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(__dirname, "../..");

describe("task list typography recovery", () => {
  it("event-task-list metadata row uses text-sm and avoids text-[10px] chips", () => {
    const src = readFileSync(join(ROOT, "components/playbooks/event-task-list.tsx"), "utf8");
    assert.match(src, /flex flex-wrap items-center gap-x-2 gap-y-0\.5 text-sm text-muted-foreground/);
    assert.doesNotMatch(src, /text-\[10px\]/);
    assert.match(src, /uppercase tracking-wide">optional</);
  });

  it("timeline entry times use text-sm font-semibold", () => {
    const src = readFileSync(join(ROOT, "components/events/timeline/timeline-view.tsx"), "utf8");
    assert.match(src, /shrink-0 text-sm font-semibold text-heading/);
    assert.match(src, /text-xs text-muted-foreground italic">No time set</);
  });
});
