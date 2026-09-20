import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  STANDARD_PIPELINE_NAME,
  STANDARD_PIPELINE_STAGE_NAMES,
  STANDARD_PIPELINE_STAGES,
} from "@/lib/pipeline-templates/standard";
import { STANDARD_SALES_PIPELINE_NAME } from "@/lib/leads/sales-stages";

describe("Standard pipeline baseline", () => {
  it("locks the product stage names and order", () => {
    assert.equal(STANDARD_PIPELINE_NAME, "Standard");
    assert.equal(STANDARD_SALES_PIPELINE_NAME, "Standard");
    assert.deepEqual(STANDARD_PIPELINE_STAGE_NAMES, [
      "New Inquiry",
      "In Workflow",
      "Tour Scheduled",
      "Custom Proposal",
      "Contract Sent",
      "Follow-Up",
      "Booked",
      "Lost",
    ]);
    assert.equal(STANDARD_PIPELINE_STAGES.length, 8);
    assert.equal(STANDARD_PIPELINE_STAGES[0].canonicalStage, "inquiry");
    assert.equal(STANDARD_PIPELINE_STAGES[2].canonicalStage, "tour");
    assert.equal(STANDARD_PIPELINE_STAGES[3].canonicalStage, "proposal");
    assert.equal(STANDARD_PIPELINE_STAGES[5].canonicalStage, "decision");
    assert.equal(STANDARD_PIPELINE_STAGES[6].canonicalStage, "booked");
    assert.equal(STANDARD_PIPELINE_STAGES[7].canonicalStage, "lost");
  });

  it("labels Leads Customize Pipeline (not Pipeline Templates)", () => {
    const leads = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    const board = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");
    assert.match(leads, /Customize Pipeline/);
    assert.match(board, /Customize Pipeline/);
    assert.doesNotMatch(leads, />Pipeline Templates</);
    assert.doesNotMatch(board, />Pipeline Templates</);
  });

  it("provisions Standard on venue create and workspace starters", () => {
    const migration = readFileSync(
      resolve("supabase/migrations/20261403400000_standard_pipeline_baseline.sql"),
      "utf8",
    );
    const starters = readFileSync(resolve("lib/provisioning/starters.ts"), "utf8");
    assert.match(migration, /venues_seed_standard_sales_pipeline/);
    assert.match(migration, /reset_venue_to_standard_pipeline/);
    assert.match(migration, /after insert on public\.venues/);
    assert.match(migration, /'In Workflow'/);
    assert.match(migration, /'Custom Proposal'/);
    assert.match(migration, /'Contract Sent'/);
    assert.match(migration, /'Follow-Up'/);
    assert.match(migration, /name = 'Standard'/);
    assert.match(starters, /key: "standard_pipeline"/);
    assert.match(starters, /ensure_standard_sales_pipeline/);
  });
});
