/**
 * Stage 1F customer handoff — isolated file CRM store.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import type { Relationship } from "./types.ts";

const prevStore = process.env.HTC_CRM_STORE;
const prevPath = process.env.RELATIONSHIPS_DATA_PATH;

let dataDir = "";

function baseRelationship(overrides: Partial<Relationship> = {}): Relationship {
  const now = new Date().toISOString();
  return {
    id: "rel_stage1f_handoff",
    venue: { name: "Handoff Venue", city: "Austin", state: "TX" },
    owner: {
      id: "c_owner",
      firstName: "Ada",
      lastName: "Owner",
      email: "ada-handoff@example.com",
    },
    status: "white_glove_implementation",
    health: "good",
    assignedTeamMemberId: "tm_eli",
    planId: "gather",
    planName: "Gather",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "white_glove",
    currentStageLabel: "White Glove Implementation",
    lastContactAt: now,
    createdAt: now,
    updatedAt: now,
    supportOpenCount: 0,
    salesStage: "closed_won",
    customerSuccessStage: "implementation",
    productSync: {
      status: "completed",
      steps: [],
      venueId: "00000000-0000-4000-8000-000000000099",
      adapter: "local",
    },
    ...overrides,
  };
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "htc-crm-1f-"));
  process.env.HTC_CRM_STORE = "file";
  process.env.RELATIONSHIPS_DATA_PATH = dataDir;
});

after(async () => {
  if (prevStore === undefined) delete process.env.HTC_CRM_STORE;
  else process.env.HTC_CRM_STORE = prevStore;
  if (prevPath === undefined) delete process.env.RELATIONSHIPS_DATA_PATH;
  else process.env.RELATIONSHIPS_DATA_PATH = prevPath;
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

describe("Stage 1F customer handoff", () => {
  it("stamps relationship.meta.customerHandoffAt and a timeline note", async () => {
    const { withLiveStore } = await import("./store.ts");
    await withLiveStore((s) => {
      s.relationships.push(baseRelationship());
    });

    const { recordCustomerHandoff } = await import("./lifecycle.ts");
    const { loadLiveStore } = await import("./store.ts");

    const result = await recordCustomerHandoff({
      relationshipId: "rel_stage1f_handoff",
      actorId: "tm_test_stage1f",
      note: "Stage 1F handoff smoke",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.ok(result.relationship.meta?.customerHandoffAt);
    assert.equal(result.relationship.meta?.customerHandoffBy, "tm_test_stage1f");
    assert.equal(result.relationship.meta?.customerHandoffNote, "Stage 1F handoff smoke");

    const after = await loadLiveStore();
    const evt = after.timelineEvents.find(
      (e) =>
        e.relationshipId === "rel_stage1f_handoff" &&
        e.meta?.trigger === "lifecycle.record_customer_handoff",
    );
    assert.ok(evt, "timeline handoff event expected");
  });
});
