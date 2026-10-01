/**
 * Discard deletes the draft — never archives into Draft History.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { LuvDraft } from "@/lib/luv/drafts";
import {
  applyDiscardResult,
  draftHistoryDrafts,
  pendingReviewDrafts,
  withDraftStatus,
  withoutDraft,
} from "@/lib/luv/draft-status";

function draft(partial: Partial<LuvDraft> & Pick<LuvDraft, "id" | "status">): LuvDraft {
  return {
    entityType: "lead",
    entityId: "lead-1",
    draftType: "follow_up_email",
    subject: "Checking in",
    content: "Hi there…",
    createdAt: "2026-09-29T12:00:00.000Z",
    ...partial,
  };
}

describe("Luv draft discard = delete", () => {
  it("pending draft exists under pending review", () => {
    const drafts = [draft({ id: "pending-1", status: "pending_review" })];
    assert.deepEqual(pendingReviewDrafts(drafts).map((d) => d.id), ["pending-1"]);
  });

  it("successful discard removes the draft from local state", () => {
    const before = [
      draft({ id: "d1", status: "pending_review" }),
      draft({ id: "d2", status: "pending_review" }),
    ];
    const after = withoutDraft(before, "d1");
    assert.deepEqual(after.map((d) => d.id), ["d2"]);
    assert.equal(pendingReviewDrafts(after).length, 1);
    assert.equal(draftHistoryDrafts(after).length, 0);
  });

  it("discarded draft must not appear in draft history", () => {
    // Legacy discarded rows (if any) are excluded from history; after delete they are gone.
    const drafts = [
      draft({ id: "a", status: "accepted" }),
      draft({ id: "d", status: "discarded" }),
      draft({ id: "p", status: "pending_review" }),
    ];
    assert.deepEqual(draftHistoryDrafts(drafts).map((d) => d.id), ["a"]);
    assert.deepEqual(pendingReviewDrafts(drafts).map((d) => d.id), ["p"]);
  });

  it("a second newly generated draft can still appear after discard", () => {
    let drafts = [draft({ id: "old", status: "pending_review" })];
    drafts = withoutDraft(drafts, "old");
    drafts = [draft({ id: "new", status: "pending_review" }), ...drafts];
    assert.deepEqual(pendingReviewDrafts(drafts).map((d) => d.id), ["new"]);
  });

  it("failed discard leaves the pending draft visible (no optimistic remove)", () => {
    const before = [draft({ id: "d1", status: "pending_review" })];
    // UI only calls withoutDraft after ok:true — failed path keeps before.
    assert.equal(pendingReviewDrafts(before).length, 1);
    assert.equal(withoutDraft(before, "d1").length, 0);
  });

  it("failed deletion reports an error and keeps the draft (applyDiscardResult)", () => {
    const before = [draft({ id: "d1", status: "pending_review" })];
    const next = applyDiscardResult(before, "d1", {
      ok: false,
      message: "Couldn't discard that draft. Please try again.",
    });
    assert.equal(next.drafts.length, 1);
    assert.equal(next.error, "Couldn't discard that draft. Please try again.");
  });
});

describe("deleteDraft service + action wiring", () => {
  const draftsSrc = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
  const actionsSrc = readFileSync(resolve("app/(app)/leads/[id]/luv-actions.ts"), "utf8");
  const panel = readFileSync(resolve("components/luv/luv-draft-panel.tsx"), "utf8");

  it("issues DELETE scoped by draft id and venue_id", () => {
    assert.match(draftsSrc, /export async function deleteDraft/);
    const fn = draftsSrc.slice(draftsSrc.indexOf("export async function deleteDraft"));
    assert.match(fn, /\.delete\(\)/);
    assert.match(fn, /\.eq\("id", draftId\)/);
    assert.match(fn, /\.eq\("venue_id", venue\.id\)/);
    assert.doesNotMatch(fn.slice(0, 1200), /status:\s*"discarded"|update\(\{\s*status:\s*"discarded"/);
  });

  it("does not archive discard as status=discarded", () => {
    assert.doesNotMatch(draftsSrc, /status:\s*"accepted"\s*\|\s*"discarded"/);
    assert.match(draftsSrc, /status:\s*"accepted"/);
    assert.match(actionsSrc, /export async function deleteDraftAction/);
    assert.doesNotMatch(actionsSrc, /"discarded"/);
  });

  it("Discard UI deletes then removes locally; failure keeps draft and toasts", () => {
    assert.match(panel, /deleteDraftAction\(draft\.id, leadId\)/);
    assert.match(panel, /withoutDraft/);
    assert.match(panel, /applyDiscardResult/);
    assert.match(panel, /toast\.error\(next\.error\)/);
    assert.doesNotMatch(panel, /updateDraftStatusAction\(draft\.id, leadId, "discarded"\)/);
    assert.doesNotMatch(panel, /withDraftStatus\(p, id, "discarded"\)/);
  });

  it("Draft history lists accepted only", () => {
    assert.match(panel, /draftHistoryDrafts/);
    assert.doesNotMatch(
      panel,
      /pastDrafts = allDrafts\.filter\(\(d\) => d\.status !== "pending_review"\)/,
    );
  });

  it("getDraftsForLead excludes legacy discarded rows", () => {
    assert.match(draftsSrc, /\.neq\("status", "discarded"\)/);
  });

  it("foreign venue cannot delete by id alone — venue_id is always required", () => {
    const fn = draftsSrc.slice(draftsSrc.indexOf("export async function deleteDraft"));
    const deleteBlock = fn.slice(fn.indexOf(".delete()"), fn.indexOf(".delete()") + 200);
    assert.match(deleteBlock, /venue_id/);
    // Existence check is also venue-scoped before admin delete.
    assert.match(fn, /eq\("venue_id", venue\.id\)[\s\S]*maybeSingle/);
  });
});

describe("successful send/copy lifecycle still works after discard-delete", () => {
  it("accepted remains in history and out of pending", () => {
    const after = withDraftStatus(
      [draft({ id: "d1", status: "pending_review" })],
      "d1",
      "accepted",
    );
    assert.equal(pendingReviewDrafts(after).length, 0);
    assert.deepEqual(draftHistoryDrafts(after).map((d) => d.id), ["d1"]);
  });
});
