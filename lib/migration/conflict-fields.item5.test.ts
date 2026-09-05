/**
 * Item 5 — conflict-field correctness contracts.
 *
 * Dead RecordStatus "conflict" / conflictFields must not be treated as an
 * active writer contract. Vendor duplicate_likely identity lives on match
 * fields. Commit/retry needs_review must clear stale match metadata.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import {
  duplicateLikelyMatchLine,
  LEGACY_CONFLICT_BADGE_LABEL,
  needsReviewBadgeLabel,
} from "@/lib/migration/review-display";
import { HISTORICAL_RECORD_ELIGIBLE } from "@/lib/migration/historical-record";

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walkTsFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(name.name) && !name.name.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

describe("Item 5 — dead conflict / conflictFields are not an active writer contract", () => {
  it("no production writer sets status to conflict (tests may still simulate residual rows)", () => {
    const roots = ["lib/migration", "app", "components/settings"].map((r) => resolve(r));
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of walkTsFiles(root)) {
        const src = readFileSync(file, "utf8");
        // Look for assignment of status conflict in update/patch payloads.
        if (/status:\s*["']conflict["']/.test(src)) {
          hits.push(file);
        }
      }
    }
    assert.deepEqual(hits, [], `unexpected conflict status writers: ${hits.join(", ")}`);
  });

  it("no production writer assigns conflictFields to a non-null payload", () => {
    const roots = ["lib/migration", "app", "components/settings"].map((r) => resolve(r));
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of walkTsFiles(root)) {
        const src = readFileSync(file, "utf8");
        // Clearing to null is allowed (CLEAR_MATCH_METADATA); non-null object writes are not.
        if (/conflictFields:\s*\{/.test(src) || /conflict_fields:\s*\{/.test(src)) {
          hits.push(file);
        }
      }
    }
    assert.deepEqual(hits, [], `unexpected conflictFields writers: ${hits.join(", ")}`);
  });

  it("Migration Center demotes legacy conflict badge and does not treat conflictFields as review copy", () => {
    const ui = readFileSync(resolve("components/settings/migration-center.tsx"), "utf8");
    assert.match(ui, /LEGACY_CONFLICT_BADGE_LABEL/);
    assert.doesNotMatch(ui, /conflictFields/);
    assert.match(ui, /duplicateLikelyMatchLine/);
  });
});

describe("Item 5 — vendor duplicate_likely match identity (not validationErrors)", () => {
  it("formats match line from structured match fields only", () => {
    const line = duplicateLikelyMatchLine({
      matchType: "likely",
      matchedEntityId: "vendor-9",
      matchConfidence: 75,
      matchedEntityLabel: "Bloom & Co Florals",
      targetEntityType: "vendor",
    });
    assert.equal(line, "Possible match: Bloom & Co Florals · 75% match");
  });

  it("falls back when label is unknown but matchedEntityId is present", () => {
    const line = duplicateLikelyMatchLine({
      matchType: "likely",
      matchedEntityId: "vendor-9",
      matchConfidence: 75,
      matchedEntityLabel: null,
      targetEntityType: "vendor",
    });
    assert.equal(line, "Possible match: existing vendor · 75% match");
  });

  it("returns null without matchedEntityId (in-batch sibling path uses validationErrors instead)", () => {
    assert.equal(
      duplicateLikelyMatchLine({
        matchType: "likely",
        matchedEntityId: null,
        matchConfidence: 90,
        matchedEntityLabel: null,
        targetEntityType: "client",
      }),
      null,
    );
  });

  it("vendor likely dedupe path in service does not stuff identity into validationErrors", () => {
    const src = readFileSync(resolve("lib/migration/service.ts"), "utf8");
    const likelyBlock = src.slice(
      src.indexOf('if (result.matchType === "likely")'),
      src.indexOf("// No live/committed match"),
    );
    assert.match(likelyBlock, /status:\s*"duplicate_likely"/);
    assert.match(likelyBlock, /matchedEntityId:\s*result\.matchedEntityId/);
    assert.doesNotMatch(likelyBlock, /validationErrors/);
  });
});

describe("Item 5 — needs_review badge correctness (not always parse failure)", () => {
  it("labels scheduling / unexpected / parse / generic cases distinctly", () => {
    assert.equal(
      needsReviewBadgeLabel([`${HISTORICAL_RECORD_ELIGIBLE}: past date`], true),
      "Scheduling conflict",
    );
    assert.equal(
      needsReviewBadgeLabel(["An unexpected error interrupted this import. Try again."], true),
      "Import interrupted",
    );
    assert.equal(needsReviewBadgeLabel(["Missing required field"], false), "Couldn't read this row");
    assert.equal(needsReviewBadgeLabel(["Something else"], true), "Needs attention");
  });

  it("exports a demoted legacy conflict badge label", () => {
    assert.equal(LEGACY_CONFLICT_BADGE_LABEL, "Needs attention");
  });
});

describe("Item 5 — retry/commit clears stale match metadata on needs_review", () => {
  it("CLEAR_MATCH_METADATA is applied on commit and retry failure/success patches", () => {
    const src = readFileSync(resolve("lib/migration/service.ts"), "utf8");
    assert.match(src, /const CLEAR_MATCH_METADATA/);
    // Every needs_review update from commitSession / retryOwnRecord spreads it.
    const commitFn = src.slice(src.indexOf("export async function commitSession"), src.indexOf("export async function retryOwnRecord"));
    const retryFn = src.slice(src.indexOf("export async function retryOwnRecord"), src.indexOf("\nexport async function ", src.indexOf("export async function retryOwnRecord") + 1));
    const needsReviewInCommit = commitFn.match(/status:\s*"needs_review"/g) ?? [];
    assert.ok(needsReviewInCommit.length >= 2, "commitSession should write needs_review on failure paths");
    assert.equal(
      (commitFn.match(/\.\.\.CLEAR_MATCH_METADATA/g) ?? []).length,
      (commitFn.match(/status:\s*"needs_review"/g) ?? []).length + (commitFn.match(/status:\s*"committed"/g) ?? []).length,
      "commitSession committed + needs_review patches must clear match metadata",
    );
    assert.ok((retryFn.match(/\.\.\.CLEAR_MATCH_METADATA/g) ?? []).length >= 2);
  });
});
