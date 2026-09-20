import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  STANDARD_PIPELINE_COLORS,
  STANDARD_PIPELINE_NAME,
  STANDARD_PIPELINE_PROBABILITIES,
  STANDARD_PIPELINE_STAGE_NAMES,
  STANDARD_PIPELINE_STAGES,
} from "@/lib/pipeline-templates/standard";
import { PIPELINE_STAGE_COLORS } from "@/lib/pipeline-templates/constants";
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
  });

  it("locks reporting categories", () => {
    assert.deepEqual(
      STANDARD_PIPELINE_STAGES.map((s) => s.canonicalStage),
      ["inquiry", "inquiry", "tour", "proposal", "proposal", "decision", "booked", "lost"],
    );
  });

  it("locks probabilities to the screenshot Standard", () => {
    assert.deepEqual(STANDARD_PIPELINE_PROBABILITIES, [10, 20, 50, 60, 85, 70, 95, 0]);
    assert.doesNotMatch(
      JSON.stringify(STANDARD_PIPELINE_PROBABILITIES),
      /25|90|100|,40|,75/,
    );
  });

  it("locks palette swatches to the screenshot Standard", () => {
    assert.deepEqual(STANDARD_PIPELINE_COLORS, [
      PIPELINE_STAGE_COLORS[2].value, // Soft Sage — New Inquiry
      PIPELINE_STAGE_COLORS[1].value, // Forest Sage — In Workflow
      PIPELINE_STAGE_COLORS[2].value, // Soft Sage — Tour Scheduled
      PIPELINE_STAGE_COLORS[4].value, // Linen — Custom Proposal
      PIPELINE_STAGE_COLORS[3].value, // Warm Taupe — Contract Sent
      PIPELINE_STAGE_COLORS[1].value, // Forest Sage — Follow-Up
      PIPELINE_STAGE_COLORS[0].value, // Heritage Sage — Booked
      PIPELINE_STAGE_COLORS[5].value, // Dusty Rose — Lost
    ]);
    assert.deepEqual(STANDARD_PIPELINE_COLORS, [
      "#B9D1C2",
      "#4F5F4F",
      "#B9D1C2",
      "#DED6CA",
      "#B8AEA1",
      "#4F5F4F",
      "#5D6F5D",
      "#D8A7AA",
    ]);
  });

  it("labels Leads Customize Pipeline (not Pipeline Templates)", () => {
    const leads = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    const board = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");
    assert.match(leads, /Customize Pipeline/);
    assert.match(board, /Customize Pipeline/);
    assert.doesNotMatch(leads, />Pipeline Templates</);
    assert.doesNotMatch(board, />Pipeline Templates</);
  });

  it("SQL seed uses the locked probabilities and colors (no older seed)", () => {
    const migration = readFileSync(
      resolve("supabase/migrations/20261403600000_standard_pipeline_locked_defaults.sql"),
      "utf8",
    );
    const starters = readFileSync(resolve("lib/provisioning/starters.ts"), "utf8");
    assert.match(migration, /_standard_pipeline_insert_stages/);
    assert.match(migration, /probability = 10 and color = '#B9D1C2'/);
    assert.match(migration, /probability = 20 and color = '#4F5F4F'/);
    assert.match(migration, /probability = 60 and color = '#DED6CA'/);
    assert.match(migration, /probability = 70 and color = '#4F5F4F'/);
    assert.match(migration, /probability = 95 and color = '#5D6F5D'/);
    assert.match(migration, /'#D8A7AA', 7, 'lost',\s+0\)/);
    assert.doesNotMatch(migration, /'#4F5F4F', 1, 'inquiry',\s+25\)/);
    assert.doesNotMatch(migration, /'#D8A7AA', 5, 'decision', 90\)/);
    assert.doesNotMatch(migration, /'#6F6A61', 6, 'booked',\s+100\)/);
    assert.match(migration, /_standard_pipeline_is_prior_product_seed/);
    assert.match(starters, /key: "standard_pipeline"/);
    assert.match(starters, /ensure_standard_sales_pipeline/);
  });

  it("venue create trigger and reset still provision Standard", () => {
    const baseline = readFileSync(
      resolve("supabase/migrations/20261403400000_standard_pipeline_baseline.sql"),
      "utf8",
    );
    const locked = readFileSync(
      resolve("supabase/migrations/20261403600000_standard_pipeline_locked_defaults.sql"),
      "utf8",
    );
    assert.match(baseline, /venues_seed_standard_sales_pipeline/);
    assert.match(baseline, /after insert on public\.venues/);
    assert.match(locked, /reset_venue_to_standard_pipeline/);
    assert.match(locked, /perform public\.reset_venue_to_standard_pipeline/);
  });
});
