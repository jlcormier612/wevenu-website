import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Practice Run PM-04 planning collaboration", () => {
  it("extends explore_planning copy for prepare → share → client → review", () => {
    const journey = read("lib/practice-run/journey.ts");
    assert.match(journey, /Plan with Maya/);
    assert.match(journey, /share what the couple should see/i);
    assert.match(journey, /PracticePlanningSnapshot/);
    assert.match(journey, /emptyPracticePlanning/);
    const ui = read("components/setup-hub/practice-run-journey.tsx");
    assert.match(ui, /practice-prepare-planning/);
    assert.match(ui, /practice-share-planning/);
    assert.match(ui, /practice-open-client-planning/);
    assert.match(ui, /practice-finish-planning-review/);
    assert.doesNotMatch(ui, /Coming soon|Coming next|PM-0[0-9]/i);
  });

  it("seeds and shares planning through dedicated practice services", () => {
    const seed = read("lib/practice-run/planning-seed.ts");
    const service = read("lib/practice-run/planning-service.ts");
    assert.match(seed, /seedPracticePlanningResources/);
    assert.match(seed, /sharePracticePlanningResources/);
    assert.match(seed, /practice_fallback/);
    assert.match(seed, /is_couple_visible/);
    assert.match(seed, /couple_websites/);
    assert.match(service, /preparePracticePlanning/);
    assert.match(service, /sharePracticePlanning/);
    assert.match(service, /shareTimelineWithCouple/);
    assert.match(service, /markPracticePlanningReviewed/);
  });

  it("wires server actions without unfinished labels", () => {
    const actions = read("app/(app)/setup-hub/practice-run/actions.ts");
    assert.match(actions, /preparePracticePlanningAction/);
    assert.match(actions, /sharePracticePlanningAction/);
    assert.match(actions, /markPracticeClientTriedAction/);
    assert.match(actions, /markPracticePlanningReviewedAction/);
    assert.doesNotMatch(actions, /Coming soon|impersonat/i);
  });

  it("parses planning snapshot fields in journey parsePracticeJourney", () => {
    const journey = read("lib/practice-run/journey.ts");
    assert.match(journey, /row\.planning/);
    assert.match(journey, /preparedAt/);
    assert.match(journey, /sharedAt/);
    assert.match(journey, /clientTriedAt/);
    assert.match(journey, /reviewedAt/);
  });

  it("keeps public website publish in the side-effect registry", () => {
    const registry = read("lib/practice-run/side-effect-registry.ts");
    assert.match(registry, /public_website_publish/);
    assert.match(registry, /draft couple websites only/);
  });
});
