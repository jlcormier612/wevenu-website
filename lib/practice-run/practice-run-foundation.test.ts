import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { mapPracticeRun } from "@/lib/practice-run/repository";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Practice Run foundation wiring", () => {
  it("maps durable practice_run rows", () => {
    const run = mapPracticeRun({
      id: "run-1",
      venue_id: "venue-1",
      status: "in_progress",
      celebration_name: "Maya & Jordan Practice Wedding",
      sample_lead_id: "lead-1",
      sample_client_id: "client-1",
      sample_event_id: "event-1",
      sample_relationship_id: "rel-1",
      created_by: "user-1",
      created_at: "2026-11-17T00:00:00.000Z",
      updated_at: "2026-11-17T00:00:00.000Z",
      last_opened_at: "2026-11-17T00:00:00.000Z",
    });
    assert.equal(run.venueId, "venue-1");
    assert.equal(run.sampleEventId, "event-1");
    assert.equal(run.status, "in_progress");
    assert.equal(run.journey.currentStageId, "meet_inquiry");
    assert.equal(run.practiceBookedAt, null);
  });

  it("connects milestone 4 to Start/Continue Practice Run with approved copy", () => {
    const page = read("app/(app)/setup-hub/take-a-look/page.tsx");
    assert.match(page, /See Hello to Cheers in action/);
    assert.match(page, /Start Practice Run/);
    assert.match(page, /Continue Practice Run/);
    assert.match(page, /without sending[\s\S]*collecting payments/);
    assert.match(page, /startOrResumePracticeRunAction/);
    assert.doesNotMatch(page, /Demo Mode|Preview Only|Test Event/);
  });

  it("keeps the Practice Run shell free of unfinished placeholders", () => {
    const shell = read("components/setup-hub/practice-run-shell.tsx");
    assert.match(shell, /Practice Run/);
    assert.match(shell, /practice-run-perspective-switcher/);
    assert.match(shell, /practice-perspective-venue/);
    assert.match(shell, /practice-perspective-client/);
    assert.match(shell, /Return to setup/);
    assert.doesNotMatch(shell, /Coming next|Coming soon|Under construction|PM-0[0-9]/i);
    assert.doesNotMatch(shell, /impersonat/i);
    assert.doesNotMatch(shell, /Resume journey/);
  });

  it("creates draft sample Events without booking occupancy or outbound effects", () => {
    const sample = read("lib/practice-run/sample-wedding.ts");
    assert.match(sample, /status: \"draft\"/);
    assert.match(sample, /exclude_from_business_reporting/);
    assert.match(sample, /practice_run_id/);
    assert.doesNotMatch(sample, /bookClient|sendEmail|createPaymentIntent|enqueue/);
    assert.match(sample, /historicalImport|true/);
  });

  it("scopes Practice Run access to the current venue", () => {
    const service = read("lib/practice-run/service.ts");
    assert.match(service, /getPracticeRunForVenue/);
    assert.match(service, /getCurrentVenue/);
    assert.match(service, /startOrResumePracticeRun/);
  });

  it("prepares the practice_runs migration with RLS and one-active uniqueness", () => {
    const sql = read("supabase/migrations/20270128120000_practice_runs.sql");
    assert.match(sql, /create table if not exists public\.practice_runs/);
    assert.match(sql, /practice_runs_one_active_per_venue/);
    assert.match(sql, /current_user_venue_id\(\)/);
    assert.match(sql, /practice_run_id/);
    assert.match(sql, /DO NOT APPLY/);
  });

  it("excludes practice Events from SaaS event-volume loading", () => {
    const volume = read("shared/pricing/event-volume-repository.ts");
    assert.match(volume, /practice_run_id/);
    assert.match(volume, /\.is\(\"practice_run_id\", null\)/);
    assert.match(volume, /exclude_from_business_reporting/);
  });
});
