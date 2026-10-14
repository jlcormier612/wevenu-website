/**
 * Attention helpers remain available after aggregate health UI deferral.
 * Launch Communication Health no longer renders the Attention list; Inbox
 * remains the recovery surface for individual failed messages.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  attentionHistoryHref,
  isAttentionHistoryFilterActive,
} from "@/lib/communication/attention-history";
import {
  BACK_TO_RECENT_MESSAGES,
  RECENT_MESSAGES_HEADING,
} from "@/lib/communication/message-history-copy";

/** Preserved branching contract for Attention filter helpers (not currently rendered). */
function emptyAttentionBackLinkState(opts: {
  attentionParam: string | null | undefined;
  needsAttention: number;
}) {
  const attentionOnly = isAttentionHistoryFilterActive(opts.attentionParam);
  const showAttentionFilter = attentionOnly && opts.needsAttention > 0;
  const showEmptyAttentionBackLink = attentionOnly && opts.needsAttention === 0;
  return {
    attentionOnly,
    showAttentionFilter,
    showEmptyAttentionBackLink,
    backLink:
      showEmptyAttentionBackLink
        ? { href: "/messaging/health", label: BACK_TO_RECENT_MESSAGES }
        : null,
    heading: showAttentionFilter
      ? "Messages that need your attention"
      : RECENT_MESSAGES_HEADING,
    listHidden: showEmptyAttentionBackLink,
  };
}

describe("empty Attention back-link — isolated fixtures (helpers preserved)", () => {
  it("?attention=1 with zero attention maps to Back to recent messages → /messaging/health", () => {
    const s = emptyAttentionBackLinkState({ attentionParam: "1", needsAttention: 0 });
    assert.equal(s.attentionOnly, true);
    assert.equal(s.showAttentionFilter, false);
    assert.equal(s.showEmptyAttentionBackLink, true);
    assert.deepEqual(s.backLink, {
      href: "/messaging/health",
      label: "Back to recent messages",
    });
    assert.equal(s.heading, RECENT_MESSAGES_HEADING);
    assert.equal(s.listHidden, true);
    assert.equal(s.backLink!.href.includes("attention"), false);
  });

  it("?attention=1 with non-zero attention keeps filtered-view helper contract", () => {
    const s = emptyAttentionBackLinkState({ attentionParam: "1", needsAttention: 50 });
    assert.equal(s.showAttentionFilter, true);
    assert.equal(s.showEmptyAttentionBackLink, false);
    assert.equal(s.backLink, null);
    assert.equal(s.heading, "Messages that need your attention");
    assert.equal(s.listHidden, false);
  });

  it("default view (no attention param) never shows the empty-attention back-link", () => {
    const s = emptyAttentionBackLinkState({ attentionParam: undefined, needsAttention: 0 });
    assert.equal(s.attentionOnly, false);
    assert.equal(s.showEmptyAttentionBackLink, false);
    assert.equal(s.backLink, null);
    assert.equal(s.heading, RECENT_MESSAGES_HEADING);
  });

  it("attention href helper stays non-interactive when count is 0", () => {
    assert.equal(attentionHistoryHref(0), null);
    assert.equal(attentionHistoryHref(50), "/messaging/health?attention=1");
  });
});

describe("empty Attention — health page launch presentation", () => {
  const src = readFileSync("app/(app)/messaging/health/page.tsx", "utf8");

  it("defers Attention list UI while keeping Readiness", () => {
    assert.match(src, /ReadinessChecklist/);
    assert.doesNotMatch(src, /MessageHistoryList/);
    assert.doesNotMatch(src, /BACK_TO_RECENT_MESSAGES/);
    assert.doesNotMatch(src, /Messages that need your attention/);
    assert.doesNotMatch(src, /Clear filter/);
  });
});
