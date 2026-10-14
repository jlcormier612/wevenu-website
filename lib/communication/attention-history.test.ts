import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  NEEDS_ATTENTION_STATUSES,
  attentionHistoryHref,
  attentionTileAriaLabel,
  countNeedsAttentionStatuses,
  isAttentionHistoryFilterActive,
  isNeedsAttentionStatus,
  pageAttentionItems,
} from "@/lib/communication/attention-history";
import { aggregateOutboundStatusCounts } from "@/lib/communication/dashboard-counts";
import { isDeliveryFailureStatus } from "@/lib/communication/status-labels";
import { resolveDeliveryDisplay } from "@/lib/conversations/delivery-display";

describe("attention history — count/filter semantics", () => {
  it("eligible statuses are failed and undelivered only (not pending confirmation)", () => {
    assert.deepEqual([...NEEDS_ATTENTION_STATUSES], ["failed", "undelivered"]);
    assert.equal(isNeedsAttentionStatus("failed"), true);
    assert.equal(isNeedsAttentionStatus("undelivered"), true);
    assert.equal(isNeedsAttentionStatus("accepted"), false);
    assert.equal(isNeedsAttentionStatus("sending"), false);
    assert.equal(isNeedsAttentionStatus("delivered"), false);
    for (const s of NEEDS_ATTENTION_STATUSES) {
      assert.equal(isDeliveryFailureStatus(s), true);
    }
  });

  it("count and filter eligibility stay aligned with dashboard aggregation", () => {
    const statuses = [
      "failed",
      "undelivered",
      "accepted",
      "sending",
      "delivered",
      "failed",
    ];
    assert.equal(countNeedsAttentionStatuses(statuses), 3);
    assert.equal(aggregateOutboundStatusCounts(statuses).needsAttention, 3);
  });

  it("does not inflate the count for duplicate status values beyond one row each", () => {
    // Each array entry is one outbound row; same status twice = two messages.
    assert.equal(countNeedsAttentionStatuses(["failed", "failed"]), 2);
    // Null / non-failure rows must not contribute.
    assert.equal(countNeedsAttentionStatuses(["failed", null, undefined, "accepted"]), 1);
  });

  it("empty attention state has no interactive destination", () => {
    assert.equal(attentionHistoryHref(0), null);
    assert.equal(attentionHistoryHref(-1), null);
    assert.equal(attentionTileAriaLabel(0), "No messages need your attention");
  });

  it("count of 1 and >1 navigate to the same attention-filtered history view", () => {
    assert.equal(attentionHistoryHref(1), "/messaging/health?attention=1");
    assert.equal(attentionHistoryHref(12), "/messaging/health?attention=1");
    assert.equal(isAttentionHistoryFilterActive("1"), true);
    assert.equal(isAttentionHistoryFilterActive("true"), true);
    assert.equal(isAttentionHistoryFilterActive("0"), false);
    assert.equal(isAttentionHistoryFilterActive(undefined), false);
    assert.match(attentionTileAriaLabel(1), /1 message need your attention/i);
    assert.match(attentionTileAriaLabel(4), /4 messages need your attention/i);
  });

  it("pagination exposes every qualifying message beyond the first page", () => {
    const items = Array.from({ length: 45 }, (_, i) => ({ id: `m${i}` }));
    const page1 = pageAttentionItems(items, 20, 1);
    assert.equal(page1.pageItems.length, 20);
    assert.equal(page1.hasMore, true);
    assert.equal(page1.total, 45);
    const page3 = pageAttentionItems(items, 20, 3);
    assert.equal(page3.pageItems.length, 5);
    assert.equal(page3.hasMore, false);
    const seen = new Set([
      ...page1.pageItems.map((i) => i.id),
      ...pageAttentionItems(items, 20, 2).pageItems.map((i) => i.id),
      ...page3.pageItems.map((i) => i.id),
    ]);
    assert.equal(seen.size, 45);
  });
});

describe("attention history — deferred aggregate UI + preserved semantics", () => {
  it("health page defers aggregate tiles/lists and keeps Communication Readiness", () => {
    const src = readFileSync("app/(app)/messaging/health/page.tsx", "utf8");
    assert.match(src, /ReadinessChecklist/);
    assert.match(src, /data-testid="communication-readiness"/);
    assert.doesNotMatch(src, /CommunicationHealthWidget/);
    assert.doesNotMatch(src, /MessageHistoryList/);
    assert.doesNotMatch(src, /attention-stat-card/);
    assert.doesNotMatch(src, /getCommunicationDashboardData/);
    assert.doesNotMatch(src, /Messages that need your attention/);
  });

  it("attention helpers and dashboard filter semantics remain available", () => {
    assert.equal(attentionHistoryHref(1), "/messaging/health?attention=1");
    const dashboard = readFileSync("lib/communication/dashboard.ts", "utf8");
    assert.match(dashboard, /NEEDS_ATTENTION_STATUSES/);
    assert.match(dashboard, /\.in\("status", \[\.\.\.NEEDS_ATTENTION_STATUSES\]\)/);
    assert.match(dashboard, /ATTENTION_HISTORY_LIMIT/);
    assert.match(dashboard, /attentionOnly/);

    const tile = readFileSync("components/dashboard-system/stat-tile.tsx", "utf8");
    assert.match(tile, /ariaLabel\?:/);
    assert.match(tile, /focus-visible:ring-2 focus-visible:ring-ring/);
  });

  it("compact badge keeps wrap-safe label; detail lives in timeline popover", () => {
    const badge = readFileSync("components/messaging/message-status-badge.tsx", "utf8");
    assert.match(badge, /break-words/);
    assert.match(badge, /whitespace-normal/);
    assert.match(badge, /max-w-full/);
    assert.doesNotMatch(badge, /truncate/);
    assert.doesNotMatch(badge, /message-failure-explanation/);

    const popover = readFileSync("components/messaging/message-timeline-popover.tsx", "utf8");
    assert.match(popover, /message-failure-explanation/);
    assert.match(popover, /message-failure-next-action/);

    const list = readFileSync("components/messaging/message-history-list.tsx", "utf8");
    assert.match(list, /MessageTimelinePopover/);

    const longReason =
      "Provider rejected the address: mailbox does not exist at example.com and the bounce explanation continues with more detail.";
    const display = resolveDeliveryDisplay({
      status: "failed",
      channel: "email",
      failureReason: longReason,
      isOutbound: true,
    });
    assert.ok(display);
    assert.equal(display!.label, "Couldn't deliver");
    assert.ok(display!.reason && display!.reason.length > 40);
  });

  it("preserves existing failure vs pending confirmation semantics", () => {
    const pending = resolveDeliveryDisplay({
      status: "accepted",
      channel: "email",
      isOutbound: true,
    });
    assert.equal(pending?.label, "Sent");
    const failed = resolveDeliveryDisplay({
      status: "failed",
      channel: "email",
      failureReason: "hard bounce",
      isOutbound: true,
    });
    assert.equal(failed?.label, "Couldn't deliver");
    assert.ok(failed?.reason);
  });
});
