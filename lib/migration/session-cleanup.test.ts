/**
 * Import-scoped cleanup — safety contract (source + disposition rules).
 * Does not call rollbackImportBatch. Attribution is created_entity_id only.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "lib/migration/session-cleanup.ts"), "utf8");
const actions = readFileSync(join(process.cwd(), "app/(app)/settings/migration-actions.ts"), "utf8");
const ui = readFileSync(join(process.cwd(), "components/settings/migration-center.tsx"), "utf8");
const rollback = readFileSync(join(process.cwd(), "lib/import/batches.ts"), "utf8");

describe("session-cleanup safety contract", () => {
  it("attributes only via createdEntityId / created_entity_id — never name/email/timestamp match", () => {
    assert.match(src, /createdEntityId/);
    assert.doesNotMatch(src, /email\s*===|first_name.*last_name.*match|approximate|fuzzy/i);
    assert.doesNotMatch(src, /rollbackImportBatch\s*\(/);
    assert.doesNotMatch(src, /from ["']@\/lib\/import/);
  });

  it("never wires rollbackImportBatch into Migration Center actions or UI", () => {
    assert.doesNotMatch(actions, /rollbackImportBatch/);
    assert.doesNotMatch(ui, /rollbackImportBatch/);
    assert.match(actions, /previewImportSessionCleanup/);
    assert.match(actions, /executeImportSessionCleanup/);
    assert.match(ui, /Import cleanup/);
    assert.match(ui, /previewImportSessionCleanupAction/);
    assert.match(ui, /executeImportSessionCleanupAction/);
  });

  it("refuses Active Commitment, Event, floor_plan, and edited records automatically", () => {
    assert.match(src, /entityType === "active_commitment"/);
    assert.match(src, /entityType === "event"/);
    assert.match(src, /entityType === "floor_plan"/);
    assert.match(src, /Edited after import/);
    assert.match(src, /wasEditedSinceCommit/);
  });

  it("uses existing client/lead delete previews (financial / AC gates)", () => {
    assert.match(src, /previewDeleteClient/);
    assert.match(src, /previewDeleteLead/);
    assert.match(src, /deleteClientRecord/);
    assert.match(src, /deleteLeadRecord/);
  });

  it("requires explicit confirmation and re-checks eligibility at execute", () => {
    assert.match(src, /confirmed: boolean/);
    assert.match(src, /Confirmation required before cleanup/);
    assert.match(src, /Re-check existence \+ edit \+ financial gates at execute time/);
    assert.match(src, /Edited after preview — refused/);
  });

  it("reports deleted / review / already_gone / failed separately (no silent success)", () => {
    assert.match(src, /outcome: "deleted" \| "review" \| "already_gone" \| "failed"/);
    assert.match(src, /failed\+\+/);
    assert.match(src, /alreadyGone\+\+/);
  });

  it("deletes children before parents", () => {
    const orderMatch = src.match(/const DELETE_ORDER[\s\S]*?\];/);
    assert.ok(orderMatch);
    const order = orderMatch[0];
    const guest = order.indexOf('"guest_list"');
    const client = order.indexOf('"client"');
    const lead = order.indexOf('"lead"');
    assert.ok(guest >= 0 && client > guest, "guest_list before client");
    assert.ok(lead > 0 && client > lead, "lead before client");
  });

  it("existing batch rollback remains ungated for financials (do not wire to UI)", () => {
    assert.match(rollback, /export async function rollbackImportBatch/);
    // Documented unsafe path still exists for Import Wizard batches — MC must not call it.
    assert.doesNotMatch(src, /from ["']@\/lib\/imports/);
  });
});
