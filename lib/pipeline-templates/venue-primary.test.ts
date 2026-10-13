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

  it("live Leads board uses fixed seven sales_stage labels, not active template columns", () => {
    const page = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");
    const board = readFileSync(resolve("components/leads/pipeline-board.tsx"), "utf8");
    assert.match(page, /seven sales lifecycle labels/);
    assert.doesNotMatch(page, /venueStages=/);
    assert.match(board, /fixed seven-stage Sales Pipeline/);
    assert.doesNotMatch(board, /usingVenue/);
    assert.doesNotMatch(board, /salesStageForCanonical/);
  });

  it("Pipeline Templates uses CollectionBackLink labeled Leads like Contract Templates uses Templates", () => {
    const page = readFileSync(resolve("app/(app)/library/pipeline-templates/page.tsx"), "utf8");
    const contracts = readFileSync(resolve("app/(app)/library/contracts/page.tsx"), "utf8");
    assert.match(contracts, /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/);
    assert.match(page, /CollectionBackLink[\s\S]*href="\/leads"[\s\S]*label="Leads"/);
    const back = page.indexOf("CollectionBackLink");
    const heading = page.indexOf('title="Pipeline Templates"');
    assert.ok(back >= 0 && heading > back, "back link must render above Pipeline Templates");
    assert.doesNotMatch(page, /Back to Leads/);
    assert.doesNotMatch(page, /← Back to Leads/);
    assert.equal((page.match(/label="Leads"/g) ?? []).length, 1);
  });
});
