import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  isRecordScoped,
  recordScopeContractIds,
  recordScopeWantsClientSurface,
  recordScopeWantsEventWindow,
  recordScopeWantsLeadPipeline,
} from "./observation-record-scope";

describe("Luv observation record scope", () => {
  it("unscoped (Dashboard) wants every section", () => {
    assert.equal(isRecordScoped(undefined), false);
    assert.equal(recordScopeWantsLeadPipeline(undefined), true);
    assert.equal(recordScopeWantsEventWindow(undefined), true);
    assert.equal(recordScopeWantsClientSurface(undefined), true);
  });

  it("booked Client Workspace (event + client, no lead) skips lead pipeline", () => {
    const scope = { eventId: "ev1", clientId: "cl1", contractIds: ["c1"] };
    assert.equal(isRecordScoped(scope), true);
    assert.equal(recordScopeWantsLeadPipeline(scope), false);
    assert.equal(recordScopeWantsEventWindow(scope), true);
    assert.equal(recordScopeWantsClientSurface(scope), true);
    assert.deepEqual(recordScopeContractIds(scope), ["c1"]);
  });

  it("lead record keeps lead pipeline and skips event/client windows", () => {
    const scope = { leadId: "L1" };
    assert.equal(recordScopeWantsLeadPipeline(scope), true);
    assert.equal(recordScopeWantsEventWindow(scope), false);
    assert.equal(recordScopeWantsClientSurface(scope), false);
  });

  it("record surfaces pass scope into getLuvObservations; Dashboard does not", () => {
    const contextual = readFileSync(resolve("lib/luv/contextual-record.ts"), "utf8");
    assert.match(contextual, /getLuvObservations\(supabase, venueId, today, undefined, record\)/);
    assert.match(contextual, /filterObservationsForRecord\(all, record\)/);

    const dashboard = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
    assert.match(dashboard, /getLuvObservations\(supabase, venue\.id, today, luvSettings \?\? undefined\)/);
    assert.doesNotMatch(dashboard, /getLuvObservations\([^)]+record/);

    const observations = readFileSync(resolve("lib/luv/observations.ts"), "utf8");
    assert.match(observations, /scope\?: LuvObservationRecordScope/);
    assert.match(observations, /recordScopeWantsLeadPipeline\(scope\)/);
    assert.match(observations, /if \(scopedEventId\) q = q\.eq\("id", scopedEventId\)/);
    assert.match(observations, /planningCandidates\.map\(\(ev\) => computeEventTaskReadinessByKind/);
    assert.doesNotMatch(
      observations,
      /for \(const ev of .*planningCandidateEvents[\s\S]*await computeEventTaskReadinessByKind/,
    );
  });

  it("does not change Gate 1 / Gate 2 or follow-up drafting modules", () => {
    const inquiry = readFileSync(resolve("lib/luv/customer-facing-inquiry-context.ts"), "utf8");
    assert.match(inquiry, /Gate 1/);
    assert.match(inquiry, /Gate 2/);
    const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.match(drafts, /Gate 1 \+ Gate 2/);
    const followUp = readFileSync(resolve("lib/luv/tour-followup-pattern.ts"), "utf8");
    assert.match(followUp, /followUp|next_action|follow_up/i);
  });
});
