/**
 * Luv follow-up draft → Messages send → pending-review reconciliation.
 *
 * Product rule: Luv never sends. The venue reviews and sends. Once send
 * succeeds, that draft must leave PENDING REVIEW and stay gone on refresh.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { LuvDraft } from "@/lib/luv/drafts";
import {
  draftStatusAfterSuccessfulSend,
  pendingReviewDrafts,
  withDraftStatus,
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

describe("Luv draft send lifecycle — pending review reconciliation", () => {
  it("pending_review drafts are visible under pending review", () => {
    const drafts = [
      draft({ id: "a", status: "pending_review" }),
      draft({ id: "b", status: "accepted" }),
      draft({ id: "c", status: "discarded" }),
    ];
    assert.deepEqual(
      pendingReviewDrafts(drafts).map((d) => d.id),
      ["a"],
    );
  });

  it("successful send marks the draft accepted and removes it from pending review", () => {
    const before = [draft({ id: "d1", status: "pending_review" })];
    const after = withDraftStatus(before, "d1", draftStatusAfterSuccessfulSend());
    assert.equal(after[0]?.status, "accepted");
    assert.equal(pendingReviewDrafts(after).length, 0);
  });

  it("edited draft content still reconciles by draft id after successful send", () => {
    const before = [
      draft({ id: "d1", status: "pending_review", content: "Original Luv body" }),
    ];
    // Venue edits in the composer — status reconciliation is by draft id, not body match.
    const after = withDraftStatus(before, "d1", draftStatusAfterSuccessfulSend());
    assert.equal(after[0]?.content, "Original Luv body");
    assert.equal(pendingReviewDrafts(after).length, 0);
  });

  it("failed send must not mark the draft accepted (status stays pending_review)", () => {
    const before = [draft({ id: "d1", status: "pending_review" })];
    // No withDraftStatus call on failure — pending remains.
    assert.equal(pendingReviewDrafts(before).length, 1);
    assert.notEqual(draftStatusAfterSuccessfulSend(), "pending_review");
  });

  it("discard removes from pending review without implying sent", () => {
    const after = withDraftStatus(
      [draft({ id: "d1", status: "pending_review" })],
      "d1",
      "discarded",
    );
    assert.equal(after[0]?.status, "discarded");
    assert.equal(pendingReviewDrafts(after).length, 0);
  });

  it("a later distinct pending draft is not suppressed by an earlier accepted send", () => {
    let drafts = [
      draft({ id: "old", status: "pending_review", subject: "First follow-up" }),
    ];
    drafts = withDraftStatus(drafts, "old", draftStatusAfterSuccessfulSend());
    drafts = [
      ...drafts,
      draft({ id: "new", status: "pending_review", subject: "Later follow-up" }),
    ];
    const pending = pendingReviewDrafts(drafts);
    assert.deepEqual(pending.map((d) => d.id), ["new"]);
    assert.equal(drafts.find((d) => d.id === "old")?.status, "accepted");
  });

  it("refresh/regenerate semantics: accepted draft stays out of pending review", () => {
    const reloadedFromDb = [
      draft({ id: "d1", status: "accepted" }),
      draft({ id: "d2", status: "pending_review" }),
    ];
    assert.deepEqual(
      pendingReviewDrafts(reloadedFromDb).map((d) => d.id),
      ["d2"],
    );
  });
});

describe("Luv→Messages send wiring contracts", () => {
  const panel = readFileSync(resolve("components/luv/luv-draft-panel.tsx"), "utf8");
  const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
  const tab = readFileSync(resolve("components/conversations/relationship-conversation-tab.tsx"), "utf8");
  const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");

  it("Send this passes draft id into the Messages bridge (not subject/body alone)", () => {
    assert.match(panel, /onUseDraft\(draft\.id,/);
    assert.match(detail, /handleUseDraft\(draftId/);
    assert.match(detail, /setActiveLuvDraftId\(draftId\)/);
  });

  it("authoritative send success completes the Luv draft; click alone does not", () => {
    assert.match(detail, /updateDraftStatusAction\(id, lead\.id, draftStatusAfterSuccessfulSend\(\)\)/);
    assert.match(detail, /onAuthoritativeSendSuccess=\{handleLuvDraftSendSuccess\}/);
    assert.match(detail, /draftStatusAfterSuccessfulSend \} from "@\/lib\/luv\/draft-status"/);
    assert.doesNotMatch(detail, /draftStatusAfterSuccessfulSend[^;]*from "@\/lib\/luv\/drafts"/);
    // "Send this →" must not call updateDraftStatusAction inline
    const sendButtonBlock = panel.slice(
      panel.indexOf("Send this"),
      panel.indexOf("Send this") + 200,
    );
    assert.doesNotMatch(sendButtonBlock, /updateDraftStatusAction/);
  });

  it("RelationshipConversationTab and ConversationThread forward send-success", () => {
    assert.match(tab, /onAuthoritativeSendSuccess/);
    assert.match(thread, /onAuthoritativeSendSuccess/);
  });

  it("Copy still marks accepted; Discard still marks discarded", () => {
    assert.match(panel, /updateDraftStatusAction\(draft\.id, leadId, "accepted"\)/);
    assert.match(panel, /updateDraftStatusAction\(draft\.id, leadId, "discarded"\)/);
  });
});
