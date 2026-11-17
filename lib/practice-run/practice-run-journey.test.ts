import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  PRACTICE_FALLBACK_PACKAGE,
  PRACTICE_STAGE_IDS,
  emptyPracticeJourney,
  firstIncompleteStage,
  markStageComplete,
  markStageInProgress,
  nextContractSimStatus,
  parsePracticeJourney,
} from "@/lib/practice-run/journey";
import {
  assertPracticeSideEffectAllowed,
  isPracticeSampleEmail,
  practiceSampleEmail,
  practiceSideEffectBlockResult,
} from "@/lib/practice-run/isolation";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Practice Run PM-02 journey", () => {
  it("defines five guided stages with approved headings", () => {
    assert.deepEqual([...PRACTICE_STAGE_IDS], [
      "meet_inquiry",
      "prepare_proposal",
      "create_agreement",
      "get_ready",
      "explore_planning",
    ]);
    const copy = read("lib/practice-run/journey.ts");
    assert.match(copy, /Meet Maya & Jordan/);
    assert.match(copy, /Build their perfect celebration/);
    assert.match(copy, /Make it official/);
    assert.match(copy, /Your wedding workspace is ready/);
    assert.match(copy, /Plan with Maya & Jordan/);
    const journeyUi = read("components/setup-hub/practice-run-journey.tsx");
    assert.match(journeyUi, /I've explored this inquiry/);
    assert.match(journeyUi, /Simulate client selection/);
    assert.match(journeyUi, /Proposal ready for Maya/);
    assert.match(journeyUi, /practice-stage-card-/);
  });

  it("persists progress only through explicit completion helpers", () => {
    let journey = emptyPracticeJourney();
    journey = markStageInProgress(journey, "meet_inquiry");
    assert.equal(journey.stages.meet_inquiry.status, "in_progress");
    assert.equal(firstIncompleteStage(journey), "meet_inquiry");
    journey = markStageComplete(journey, "meet_inquiry");
    assert.equal(journey.stages.meet_inquiry.status, "complete");
    assert.equal(firstIncompleteStage(journey), "prepare_proposal");
  });

  it("keeps practice-only package fallback out of permanent libraries", () => {
    assert.equal(PRACTICE_FALLBACK_PACKAGE.id, "practice-fallback-package");
    const service = read("lib/practice-run/journey-service.ts");
    assert.match(service, /PRACTICE_FALLBACK_PACKAGE/);
    assert.doesNotMatch(service, /insertPackage|createPackage|from\(\"packages\"\)\.insert/);
    assert.match(service, /practice_booked_at|practiceBookedAt/);
    assert.doesNotMatch(service, /bookClient\(/);
  });

  it("advances simulated contract status client-first then venue", () => {
    assert.equal(nextContractSimStatus("draft"), "sent_to_client");
    assert.equal(nextContractSimStatus("sent_to_client"), "client_signed");
    assert.equal(nextContractSimStatus("client_signed"), "awaiting_venue_signature");
    assert.equal(nextContractSimStatus("awaiting_venue_signature"), "fully_executed");
    assert.equal(nextContractSimStatus("fully_executed"), null);
  });

  it("parses stored journey JSON without inventing completion", () => {
    const parsed = parsePracticeJourney({
      currentStageId: "prepare_proposal",
      stages: {
        meet_inquiry: { status: "complete", completedAt: "2026-11-17T00:00:00.000Z" },
      },
    });
    assert.equal(parsed.stages.meet_inquiry.status, "complete");
    assert.equal(parsed.stages.prepare_proposal.status, "not_started");
    assert.equal(parsed.proposal, null);
  });

  it("blocks practice sample email and availability side effects", () => {
    const email = practiceSampleEmail("a415ac52-1111-2222-3333-444444444444");
    assert.equal(isPracticeSampleEmail(email), true);
    assert.equal(isPracticeSampleEmail("real@example.com"), false);
    assert.throws(() =>
      assertPracticeSideEffectAllowed({ practiceRunId: "run-1", kind: "email" }),
    );
    const blocked = practiceSideEffectBlockResult({
      practiceRunId: "run-1",
      kind: "public_availability_block",
    });
    assert.ok(blocked);
    assert.match(blocked.message, /calendar|Practice/i);
    assert.equal(
      practiceSideEffectBlockResult({ practiceRunId: null, kind: "email" }),
      null,
    );
  });

  it("wires Back to Practice Run into Lead and Client workspaces", () => {
    const leadPage = read("app/(app)/leads/[id]/page.tsx");
    const clientPage = read("app/(app)/clients/[id]/page.tsx");
    assert.match(leadPage, /PracticeContextBanner/);
    assert.match(clientPage, /PracticeContextBanner/);
    assert.match(leadPage, /findPracticeRunForSample/);
    assert.match(clientPage, /findPracticeRunForSample/);
    const banner = read("components/setup-hub/practice-context-banner.tsx");
    assert.match(banner, /Back to Practice Run/);
  });

  it("guards bookClient and sendEmail for practice records", () => {
    const book = read("lib/booking-journey/book-client.ts");
    const email = read("lib/email/send.ts");
    const contracts = read("lib/contracts/service.ts");
    assert.match(book, /practice_run_id/);
    assert.match(book, /public_availability_block/);
    assert.match(email, /isPracticeSampleEmail/);
    assert.match(contracts, /Practice Runs simulate/);
  });

  it("adds additive journey migration without touching Production booking columns", () => {
    const sql = read("supabase/migrations/20270129120000_practice_run_journey.sql");
    assert.match(sql, /add column if not exists journey/);
    assert.match(sql, /practice_booked_at/);
    assert.match(sql, /DO NOT APPLY to Production/);
    assert.match(sql, /Never writes events\.booked_at/);
    assert.doesNotMatch(sql, /alter table public\.events/);
  });

  it("keeps Practice Run customer UI free of unfinished placeholders", () => {
    const shell = read("components/setup-hub/practice-run-shell.tsx");
    const journeyUi = read("components/setup-hub/practice-run-journey.tsx");
    assert.doesNotMatch(shell, /Coming next|Coming soon|Under construction|PM-0[0-9]/i);
    assert.doesNotMatch(journeyUi, /Coming next|Coming soon|Under construction|PM-0[0-9]/i);
    assert.doesNotMatch(journeyUi, /practice-nav-open-inquiry|practice-nav-return-setup/);
    assert.match(journeyUi, /Continue where I left off/);
    assert.match(journeyUi, /View all stages/);
  });
});
