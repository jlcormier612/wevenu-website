/**
 * Color Distribution Phase 2 — Inbox no-selection calm surface (source locks).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("Inbox no-selection calm surface (Phase 2)", () => {
  const inbox = read("app/(app)/messaging/conversation-inbox.tsx");
  const css = read("app/globals.css");

  it("renders a calm no-selection panel with preserved product copy", () => {
    assert.match(inbox, /htc-inbox-no-selection/);
    assert.match(inbox, /Select a conversation/);
    assert.match(inbox, /Choose someone from the list to read and reply by email or text\./);
  });

  it("keeps the no-selection pane desktop-only (list-first mobile)", () => {
    assert.match(
      inbox,
      /activeId \? "" : "hidden min-h-\[24rem\] md:flex md:items-center md:justify-center"/,
    );
  });

  it("does not recolor list empty states or selected ConversationThread", () => {
    assert.match(inbox, /No conversations yet/);
    assert.match(inbox, /When someone emails, texts, or messages through the portal/);
    assert.match(inbox, /No matching conversations/);
    assert.match(inbox, /<ConversationThread/);
    assert.doesNotMatch(inbox, /ConversationThread[\s\S]{0,200}htc-inbox-no-selection/);
    assert.doesNotMatch(inbox, /No conversations yet[\s\S]{0,120}htc-inbox-no-selection/);
  });

  it("scopes calm tokens under .htc-staff without new blue hex inventing", () => {
    const block = css.slice(
      css.indexOf(".htc-staff .htc-inbox-no-selection"),
      css.indexOf(".htc-staff .htc-catalog-section"),
    );
    assert.match(block, /border-color:\s*var\(--htc-border-calm\)/);
    assert.match(block, /border-left:\s*3px solid var\(--htc-calm-blue-deep\)/);
    assert.match(block, /background:\s*var\(--htc-calm-blue\)/);
    assert.doesNotMatch(block, /#eaf1f7|#d5e1eb|#dfe9f1/i);
  });

  it("does not alter Library Phase 1 calm guidance class", () => {
    assert.match(css, /\.htc-staff \.htc-library-guidance-calm/);
  });
});
