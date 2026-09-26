/**
 * Selected Package → contract merge resolution.
 *
 * Regression coverage for the Lead/Client handoff: a superseded selectionId
 * must not produce "No package is currently selected" when an active
 * replacement (or client/event active selection) exists.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("resolveActiveCommercialSelection wiring", () => {
  it("exports resolveActiveCommercialSelection and follows superseded_by_id", () => {
    const src = readFileSync(join(root, "lib/commercial-selections/service.ts"), "utf8");
    assert.match(src, /export async function resolveActiveCommercialSelection/);
    assert.match(src, /supersededById/);
    assert.match(src, /getActiveSelectedPackageForEvent/);
    assert.match(src, /getActiveSelectedPackageForClient/);
    assert.match(src, /getActiveSelectedPackageForLead/);
  });

  it("buildContractMergeData uses resolveActiveCommercialSelection", () => {
    const src = readFileSync(join(root, "lib/contracts/service.ts"), "utf8");
    assert.match(src, /resolveActiveCommercialSelection/);
    assert.doesNotMatch(
      src.slice(src.indexOf("Prefer frozen Selected Package"), src.indexOf("Prefer frozen Selected Package") + 800),
      /selection\.status !== "superseded"/,
    );
  });

  it("payment schedule does not overwrite frozen selection totals", () => {
    const src = readFileSync(join(root, "lib/contracts/service.ts"), "utf8");
    assert.match(src, /if \(!packageFromSelection\)/);
    assert.match(src, /contractTotal = fmt\(detail\.totalAmount\)/);
    // balanceRemaining is filled from the schedule when present; totals stay gated.
    assert.match(src, /balanceRemaining = formatBalanceRemaining/);
    const guardBlock = src.slice(
      src.indexOf("if (!packageFromSelection)"),
      src.indexOf("if (!packageFromSelection)") + 200,
    );
    assert.match(guardBlock, /contractTotal = fmt\(detail\.totalAmount\)/);
  });

  it("ensureCommercialCustomer resolves superseded selection ids", () => {
    const src = readFileSync(join(root, "lib/booking-journey/ensure-commercial-customer.ts"), "utf8");
    assert.match(src, /resolveActiveCommercialSelection/);
  });

  it("New Contract page canonicalizes superseded selectionId in the URL", () => {
    const src = readFileSync(join(root, "app/(app)/contracts/new/page.tsx"), "utf8");
    assert.match(src, /resolveActiveCommercialSelection/);
    assert.match(src, /selection\.id !== selectionId/);
    assert.match(src, /redirect\(`\/contracts\/new/);
  });

  it("createContract links the resolved active selection, not a stale id", () => {
    const src = readFileSync(join(root, "lib/contracts/service.ts"), "utf8");
    assert.match(src, /mergeSelectionId/);
    assert.match(src, /linkSelectionContract\(mergeSelectionId/);
  });
});

describe("package merge field semantics (source contracts)", () => {
  it("default no-package copy remains the empty-state message", () => {
    const src = readFileSync(join(root, "lib/contracts/service.ts"), "utf8");
    assert.match(src, /No package is currently selected for this booking\./);
  });

  it("formatPackageSection includes totals used by contract merge", () => {
    const src = readFileSync(join(root, "lib/commercial-selections/constants.ts"), "utf8");
    assert.match(src, /Package total:/);
    assert.match(src, /Deposit:/);
    assert.match(src, /Remaining:/);
  });
});
