import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  emptyPracticeJourney,
  isPracticeJourneyComplete,
  parsePracticeJourney,
} from "@/lib/practice-run/journey";
import { practiceSampleEmail } from "@/lib/practice-run/isolation";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Practice Run PM-05 lifecycle", () => {
  it("distinguishes finish (soft) from reset (archive + fresh run)", () => {
    const lifecycle = read("lib/practice-run/lifecycle-service.ts");
    assert.match(lifecycle, /finishPracticeRun/);
    assert.match(lifecycle, /resetPracticeRun/);
    assert.match(lifecycle, /\"archived\"/);
    assert.match(lifecycle, /\"resetting\"/);
    assert.match(lifecycle, /setPracticeRunStatus/);
    assert.match(lifecycle, /createSampleWedding/);
    assert.match(lifecycle, /cleanupPracticeSampleArtifacts/);
    assert.match(lifecycle, /PRACTICE_FINISH_COPY/);
    assert.match(read("lib/practice-run/lifecycle-copy.ts"), /PRACTICE_RESET_CONFIRM_COPY/);
    assert.doesNotMatch(lifecycle, /Coming soon/);
  });

  it("wires finish and reset actions without unfinished placeholders", () => {
    const actions = read("app/(app)/setup-hub/practice-run/actions.ts");
    assert.match(actions, /finishPracticeRunAction/);
    assert.match(actions, /resetPracticeRunAction/);
    assert.match(actions, /finishPracticeRunAndReturnAction/);
    const ui = read("components/setup-hub/practice-run-lifecycle.tsx");
    assert.match(ui, /practice-finish-return-setup/);
    assert.match(ui, /practice-reset-start-over/);
    assert.match(ui, /practice-reset-confirm/);
    assert.doesNotMatch(ui, /Coming soon|Under construction|PM-0[0-9]/i);
  });

  it("parses finishedAt on the journey and detects full completion", () => {
    const empty = emptyPracticeJourney();
    assert.equal(empty.finishedAt, null);
    assert.equal(isPracticeJourneyComplete(empty), false);

    const completeStages = Object.fromEntries(
      (["meet_inquiry", "prepare_proposal", "create_agreement", "get_ready", "explore_planning"] as const).map(
        (id) => [id, { status: "complete", completedAt: "2026-11-17T00:00:00.000Z" }],
      ),
    );
    const parsed = parsePracticeJourney({
      stages: completeStages,
      currentStageId: "explore_planning",
      finishedAt: "2026-11-17T12:00:00.000Z",
    });
    assert.equal(parsed.finishedAt, "2026-11-17T12:00:00.000Z");
    assert.equal(isPracticeJourneyComplete(parsed), true);
  });

  it("keeps practice sample emails unique across resets via run salt", () => {
    const a = practiceSampleEmail("e458f434-ec00-472c-a12f-e53c10219e16", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    const b = practiceSampleEmail("e458f434-ec00-472c-a12f-e53c10219e16", "ffffffff-1111-2222-3333-444444444444");
    assert.notEqual(a, b);
    assert.match(a, /@practice\.hellotocheers\.invalid$/);
    assert.match(read("lib/practice-run/sample-wedding.ts"), /practiceSampleEmail\(venueId, run\.id\)/);
  });

  it("surfaces finish confirmation on Take a look without making Practice mandatory", () => {
    const page = read("app/(app)/setup-hub/take-a-look/page.tsx");
    assert.match(page, /practice-finished-banner/);
    assert.match(page, /Continue Practice Run anytime|going live is still your choice/i);
    assert.match(page, /Finish setup/);
    assert.match(page, /phase-a-finish-disabled/);
    assert.match(page, /phase-a-finish-hint/);
    assert.match(page, /readyToGoLive/);
  });

  it("seeds Maya & Jordan couple photo from the approved practice asset", () => {
    const photo = read("lib/practice-run/practice-couple-photo.ts");
    assert.match(photo, /maya-jordan-couple\.png/);
    assert.match(photo, /seedPracticeCouplePhoto/);
    assert.match(photo, /client_photo_shared: true/);
    const sample = read("lib/practice-run/sample-wedding.ts");
    assert.match(sample, /seedPracticeCouplePhoto/);
  });
});
