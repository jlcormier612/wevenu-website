/**
 * Import-scoped cleanup — owner-control safety contract.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { asCleanupDeleteResult } from "@/lib/migration/session-cleanup";

const src = readFileSync(join(process.cwd(), "lib/migration/session-cleanup.ts"), "utf8");
const actions = readFileSync(join(process.cwd(), "app/(app)/settings/migration-actions.ts"), "utf8");
const ui = readFileSync(join(process.cwd(), "components/settings/migration-center.tsx"), "utf8");
const rollback = readFileSync(join(process.cwd(), "lib/import/batches.ts"), "utf8");

describe("asCleanupDeleteResult — optional failure messages", () => {
  it("passes through success", () => {
    assert.deepEqual(asCleanupDeleteResult({ ok: true }, "fallback"), { ok: true });
  });

  it("keeps a present failure message", () => {
    assert.deepEqual(
      asCleanupDeleteResult({ ok: false, message: "Vendor is still assigned." }, "Could not remove this vendor."),
      { ok: false, message: "Vendor is still assigned." },
    );
  });

  it("uses fallback when vendor failure message is absent", () => {
    assert.deepEqual(
      asCleanupDeleteResult({ ok: false }, "Could not remove this vendor."),
      { ok: false, message: "Could not remove this vendor." },
    );
  });

  it("uses fallback when failure message is empty or whitespace", () => {
    assert.deepEqual(
      asCleanupDeleteResult({ ok: false, message: "   " }, "Could not remove this vendor."),
      { ok: false, message: "Could not remove this vendor." },
    );
  });
});

describe("session-cleanup owner-control contract", () => {
  it("normalizes optional delete messages via asCleanupDeleteResult", () => {
    assert.match(src, /export function asCleanupDeleteResult/);
    assert.match(src, /asCleanupDeleteResult\(await deleteVendor_/);
    assert.match(src, /Could not remove this vendor\./);
  });

  it("attributes only via createdEntityId — never name/email match or rollbackImportBatch()", () => {
    assert.match(src, /createdEntityId/);
    assert.doesNotMatch(src, /email\s*===|first_name.*last_name.*match|approximate|fuzzy/i);
    assert.doesNotMatch(src, /rollbackImportBatch\s*\(/);
    assert.doesNotMatch(src, /from ["']@\/lib\/import/);
  });

  it("never wires rollbackImportBatch into Migration Center actions or UI", () => {
    assert.doesNotMatch(actions, /rollbackImportBatch/);
    assert.doesNotMatch(ui, /rollbackImportBatch/);
    assert.match(actions, /previewImportSessionCleanup/);
    assert.match(actions, /overrideRecordIds/);
    assert.match(ui, /Import cleanup/);
    assert.match(ui, /cleanupOverrides/);
  });

  it("uses eligible / overridable / blocked / already_gone dispositions", () => {
    assert.match(src, /"eligible" \| "overridable" \| "blocked" \| "already_gone"/);
    assert.match(src, /overridableCount/);
    assert.match(src, /blockedCount/);
  });

  it("treats edited-after-import as overridable, not a hard permanent block", () => {
    assert.match(src, /This record has changed since it was imported/);
    assert.match(src, /target\(\s*record,\s*"overridable"/);
    assert.match(src, /overrideSet\.has\(t\.recordId\)/);
    assert.doesNotMatch(src, /Edited after import — refused automatic deletion/);
  });

  it("hard-blocks Active Commitment and financial clients with plain next steps", () => {
    assert.match(src, /entityType === "active_commitment"/);
    assert.match(src, /financial records \(Event Order, invoice, or payment schedule\)/);
    assert.match(src, /signed contract or collected payments that must be preserved/);
    assert.match(src, /previewDeleteClient/);
    assert.match(src, /target\(\s*record,\s*"blocked"/);
  });

  it("treats floor_plan attribution as Documents SoR; blocks when linked seating exists", () => {
    assert.match(src, /floorPlanDocumentSeatingBlocks/);
    assert.match(src, /floor_plan: "documents"/);
    assert.match(src, /case "floor_plan"/);
    assert.match(src, /deleteDocument/);
    assert.match(src, /seating assignments, submissions, or assistance history/);
    assert.match(DELETE_ORDER_SNIPPET(), /"floor_plan"/);
  });

  it("requires confirmation and never deletes blocked rows even if listed in overrides", () => {
    assert.match(src, /confirmed: boolean/);
    assert.match(src, /Confirmation required before cleanup/);
    assert.match(src, /if \(t\.disposition === "blocked"\)/);
    // Financial re-check at execute for clients selected via override path
    assert.match(src, /previewDeleteClient\(t\.entityId\)/);
  });

  it("reports deleted / blocked / skipped / failed separately with partial summary", () => {
    assert.match(src, /outcome: "deleted" \| "blocked" \| "skipped" \| "already_gone" \| "failed"/);
    assert.match(src, /unresolved/);
    assert.match(src, /Cleanup completed for/);
    assert.match(src, /remain because they need additional review/);
  });

  it("deletes children before parents and includes floor_plan before client", () => {
    const order = DELETE_ORDER_SNIPPET();
    assert.ok(order.indexOf('"guest_list"') < order.indexOf('"client"'));
    assert.ok(order.indexOf('"floor_plan"') < order.indexOf('"client"'));
    assert.ok(order.indexOf('"lead"') < order.indexOf('"client"'));
  });

  it("UI shows reasons, next steps, and owner checkboxes for overridable rows", () => {
    assert.match(ui, /Your choice|Will remove/);
    assert.match(ui, /Blocked/);
    assert.match(ui, /Next: \{t\.nextStep\}/);
    assert.match(ui, /type="checkbox"/);
    assert.match(ui, /cleanupResult\.summary/);
  });

  it("existing batch rollback remains ungated for financials (do not wire to UI)", () => {
    assert.match(rollback, /export async function rollbackImportBatch/);
  });
});

function DELETE_ORDER_SNIPPET(): string {
  const m = src.match(/const DELETE_ORDER[\s\S]*?\];/);
  assert.ok(m);
  return m![0];
}
