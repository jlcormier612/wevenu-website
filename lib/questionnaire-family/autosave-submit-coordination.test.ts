import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  awaitPendingAutosave,
  shouldApplyAutosaveStale,
} from "@/lib/questionnaire-family/autosave-submit-coordination";

describe("questionnaire autosave / submit coordination", () => {
  it("applies autosave stale only while the form is idle (same-session race guard)", () => {
    assert.equal(shouldApplyAutosaveStale("idle"), true);
    assert.equal(shouldApplyAutosaveStale("submitting"), false);
    assert.equal(shouldApplyAutosaveStale("success"), false);
    assert.equal(shouldApplyAutosaveStale("already_submitted"), false);
    assert.equal(shouldApplyAutosaveStale("stale"), false);
  });

  it("awaits a pending autosave before submit proceeds", async () => {
    let settled = false;
    const pending = new Promise<void>((resolve) => {
      setTimeout(() => {
        settled = true;
        resolve();
      }, 20);
    });
    await awaitPendingAutosave(pending);
    assert.equal(settled, true);
  });

  it("treats a missing pending autosave as a no-op", async () => {
    await awaitPendingAutosave(null);
    await awaitPendingAutosave(undefined);
  });

  it("swallows autosave rejection so submit can still send the full payload", async () => {
    await awaitPendingAutosave(Promise.reject(new Error("network")));
  });

  it("form wires coordination helpers (source contract)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const form = readFileSync(
      resolve("components/form/couple-family-questionnaire-form.tsx"),
      "utf8",
    );
    assert.match(form, /awaitPendingAutosave/);
    assert.match(form, /shouldApplyAutosaveStale/);
    assert.match(form, /pendingAutosaveRef/);
    // Submit clears dirty so a queued debounce does not fire after Submit;
    // Submit body uses buildPayload() so latest edits are included without
    // needing the debounce to flush first.
    assert.match(form, /isDirty\.current = false/);
    assert.match(form, /await awaitPendingAutosave\(pendingAutosaveRef\.current\)/);
    assert.match(form, /if \(uiStateRef\.current === "stale"\) return/);
    assert.match(form, /familyPayload: buildPayload\(\)/);
  });

  it("draft RPCs refuse writes after submitted (late autosave cannot overwrite)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const draftSql = readFileSync(
      resolve(
        "supabase/migrations/20261369000000_questionnaire_review_changes_loop.sql",
      ),
      "utf8",
    );
    assert.match(
      draftSql,
      /status in \('sent', 'in_progress', 'changes_requested'\)/,
    );
    assert.match(draftSql, /'not_editable'/);
  });
});