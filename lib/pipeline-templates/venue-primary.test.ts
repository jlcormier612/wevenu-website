import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Pipeline Templates venue-primary UX", () => {
  it("labels reporting category distinctly from venue stage names", () => {
    const form = readFileSync(resolve("components/settings/pipeline-template-form.tsx"), "utf8");
    assert.match(form, /Your stages/);
    assert.match(form, /Reporting category/);
    assert.doesNotMatch(form, />Canonical stage</);
    assert.match(form, /Your stages are what your team works in/);
  });

  it("preserves stage ids on edit and reassigns leads when a stage is removed", () => {
    const repo = readFileSync(resolve("lib/pipeline-templates/repository.ts"), "utf8");
    assert.match(repo, /Preserve stage row ids/);
    assert.match(repo, /pipeline_stage_id: fallback/);
    assert.doesNotMatch(repo, /Stages are replaced wholesale/);
  });

  it("wires the Leads board to the active template's venue stages", () => {
    const page = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");
    const board = readFileSync(resolve("components/leads/pipeline-board.tsx"), "utf8");
    assert.match(page, /getActiveTemplate/);
    assert.match(page, /venueStages/);
    assert.match(board, /venueStages/);
    assert.match(board, /salesStageForCanonical/);
  });
});
