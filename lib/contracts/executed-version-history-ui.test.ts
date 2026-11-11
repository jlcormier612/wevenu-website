/**
 * Fully executed Version 1: fold version into Signatures; keep history for multi-version.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/contracts/contract-detail.tsx"), "utf8");

describe("executed Version 1 signatures vs version history UI", () => {
  it("hides standalone Version history for fully executed single-version contracts", () => {
    assert.match(detail, /isFullyExecutedSingleVersion/);
    assert.match(
      detail,
      /contract\.status === "signed" && !hasMeaningfulVersionHistory/,
    );
    assert.match(detail, /hasMeaningfulVersionHistory = versionFamily\.length > 1 \|\| Boolean\(basedOn\)/);
    assert.match(detail, /showStandaloneVersionHistory/);
    assert.match(detail, /\{showStandaloneVersionHistory && \(/);
    assert.match(detail, /data-testid="contract-version-history-card"/);
  });

  it("puts compact Version N on the Signatures card when fully executed V1", () => {
    assert.match(detail, /data-testid="contract-signatures-card"/);
    assert.match(detail, /data-testid="contract-version-compact"/);
    assert.match(detail, /\{isFullyExecutedSingleVersion \? \(/);
    assert.match(detail, /formatVersionLabel\(versionNumber\)/);
    // Do not restate Fully Executed beside the compact version label.
    const compactBlock = detail.slice(
      detail.indexOf('data-testid="contract-version-compact"'),
      detail.indexOf('data-testid="contract-version-compact"') + 280,
    );
    assert.doesNotMatch(compactBlock, /Fully Executed/);
  });

  it("keeps multi-version family list and based-on links in the history card", () => {
    assert.match(detail, /versionFamily\.length > 1/);
    assert.match(detail, /Based on/);
    assert.match(detail, /Created /);
    assert.match(detail, /v\.signedAt/);
    assert.match(detail, /createNewVersionFromContractAction/);
  });
});
