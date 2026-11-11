import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("library collection page load safety", () => {
  it("timeline templates page awaits ensure but ensure must not throw through", () => {
    const page = readFileSync(resolve("app/(app)/library/timeline-templates/page.tsx"), "utf8");
    assert.match(page, /await ensureTimelineStartersForCurrentVenue/);
    assert.match(page, /TimelineTemplatesSection/);
    assert.doesNotMatch(page, /couldn't load/);

    const provision = readFileSync(resolve("lib/timeline-templates/provision.ts"), "utf8");
    // Soft-fail: provision races must not crash the collection route.
    assert.match(provision, /ensureTimelineStartersForCurrentVenue/);
    assert.match(provision, /catch \(e\)/);
    assert.match(provision, /\[ensureTimelineStartersForCurrentVenue\]/);
    assert.match(provision, /return \{ ok: false, created: \[\], skipped: \[\], message \}/);
  });

  it("floor-plan / event-order / contract / inventory ensure helpers soft-fail the same way", () => {
    for (const file of [
      "lib/floor-plan-templates/provision.ts",
      "lib/event-order-templates/provision.ts",
      "lib/contracts/provision.ts",
      "lib/inventory/provision.ts",
    ]) {
      const src = readFileSync(resolve(file), "utf8");
      assert.match(src, /catch \(e\)/);
      assert.match(src, /ok: false/);
    }
  });

  it("canonical Planning Templates route is /library/playbooks (not /planning-templates)", () => {
    const hub = readFileSync(resolve("app/(app)/library/page.tsx"), "utf8");
    assert.match(hub, /href="\/library\/playbooks"/);
    assert.doesNotMatch(hub, /href="\/library\/planning-templates"/);
  });
});
