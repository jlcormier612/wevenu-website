/**
 * R1B page-data perf — request-scoped CRM snapshot + timeline index.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const storeSrc = readFileSync(join(here, "store.ts"), "utf8");
const todaySrc = readFileSync(
  join(here, "../../app/(app)/today/page.tsx"),
  "utf8",
);
const csSrc = readFileSync(
  join(here, "../../app/(app)/customer-success/page.tsx"),
  "utf8",
);
const tasksSrc = readFileSync(
  join(here, "../../app/(app)/tasks/page.tsx"),
  "utf8",
);
const renewalSrc = readFileSync(
  join(here, "../../../shared/relationships/renewal-stages.ts"),
  "utf8",
);
const wgSrc = readFileSync(
  join(here, "../../../shared/relationships/white-glove-checklist.ts"),
  "utf8",
);

describe("R1B Today/CS/Tasks data-path performance contracts", () => {
  it("memoizes workspace snapshots by CRM memory epoch + React cache()", () => {
    assert.match(storeSrc, /import \{ cache \} from "react"/);
    assert.match(storeSrc, /getLiveStoreMemoryEpoch/);
    assert.match(storeSrc, /const getWorkspaceSnapshotCached = cache\(/);
    assert.match(storeSrc, /timelineByRelationship/);
    assert.match(
      storeSrc,
      /export function getTimelineForRelationship[\s\S]*timelineByRelationship/,
    );
    assert.match(
      storeSrc,
      /Only clone seed when we actually fall back/,
    );
  });

  it("Today still builds Luv briefing + dashboard buckets from store accessors", () => {
    assert.match(todaySrc, /loadLuvBriefing/);
    assert.match(todaySrc, /getDashboardBuckets/);
  });

  it("Customer Success still computes health for visible relationships", () => {
    assert.match(csSrc, /computeRelationshipHealth/);
    assert.match(csSrc, /tickRenewalStages/);
    assert.match(csSrc, /getTimelineForRelationship/);
  });

  it("Tasks still ensures White Glove checklists before listing tasks", () => {
    assert.match(tasksSrc, /ensureWhiteGloveChecklistsInWorkspace/);
    assert.match(tasksSrc, /getTasks/);
  });

  it("renewal tick skips withLiveStore when warm probe finds no mutations", () => {
    assert.match(renewalSrc, /renewalTickWouldMutate/);
    assert.match(renewalSrc, /warmLiveStore/);
    assert.match(renewalSrc, /if \(!needsWrite\)/);
    assert.match(renewalSrc, /withLiveStore/);
  });

  it("White Glove checklist ensure skips withLiveStore when already complete", () => {
    assert.match(wgSrc, /whiteGloveRelationshipNeedsChecklist/);
    assert.match(wgSrc, /warmLiveStore/);
    assert.match(wgSrc, /if \(!needsWrite\)/);
    assert.match(wgSrc, /withLiveStore/);
  });
});
