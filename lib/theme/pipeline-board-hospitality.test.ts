/**
 * Lead Pipeline board hospitality chrome — eucalyptus headers + linen lanes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const board = readFileSync(resolve("components/leads/pipeline-board.tsx"), "utf8");
const page = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");

describe("Pipeline board hospitality", () => {
  it("keeps page title white + botanical strip", () => {
    assert.match(page, /htc-hospitality-heading/);
    assert.match(page, /htc-hospitality-intro-accent/);
    assert.match(page, /title="Pipeline"/);
  });

  it("uses eucalyptus stage headers, linen lanes, and white lead cards", () => {
    assert.match(board, /htc-pipeline-board/);
    assert.match(board, /htc-pipeline-column-header/);
    assert.match(board, /htc-badge-active/);
    assert.match(board, /htc-pipeline-lead-card/);
    assert.match(board, /htc-record-link/);
    assert.match(css, /\.htc-staff \.htc-pipeline-column-header[\s\S]*?--htc-eucalyptus-surface/);
    assert.match(css, /\.htc-staff \.htc-pipeline-column \{[\s\S]*?--htc-linen/);
    assert.match(css, /\.htc-staff \.htc-pipeline-lead-card \{[\s\S]*?background:\s*#ffffff/);
    assert.doesNotMatch(board, /bg-card\/40/);
    assert.doesNotMatch(board, /bg-muted px-1\.5/);
  });

  it("does not encode stage meaning in column fill colors", () => {
    assert.doesNotMatch(board, /stageColor|PIPELINE_STAGE_COLORS|brandColor/);
    assert.match(board, /data-pipeline-stage=\{stage\.key\}/);
  });
});
