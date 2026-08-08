import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ActivityItem } from "@/lib/portal/types";
import {
  formatHappeningSummary,
  formatHappeningWhen,
  happeningDestination,
  isMeaningfulHappeningItem,
  selectWhatsHappeningForHome,
  WHATS_HAPPENING_HOME_CAP,
  WHATS_HAPPENING_VIEW_ALL_DESTINATION,
} from "@/lib/portal/whats-happening";

const NOW = new Date("2026-08-08T15:00:00.000Z");

function item(partial: Partial<ActivityItem> & Pick<ActivityItem, "type" | "label" | "occurredAt">): ActivityItem {
  return {
    emoji: "✦",
    ...partial,
  };
}

describe("What's Happening Home presentation", () => {
  it("documents and retains only source event types that are meaningful", () => {
    const fixtures: ActivityItem[] = [
      item({ type: "guest_added", label: "Added 2 guests to your list", occurredAt: "2026-08-08T12:00:00.000Z" }),
      item({ type: "photo_uploaded", label: "Saved Florals inspiration", occurredAt: "2026-08-07T12:00:00.000Z" }),
      item({ type: "todo_completed", label: 'Checked off "Book flowers"', occurredAt: "2026-08-06T12:00:00.000Z" }),
      item({
        type: "journal_entry",
        label: 'Wrote about "Tasting day"',
        occurredAt: "2026-08-05T12:00:00.000Z",
        source: "manual",
      }),
      item({
        type: "journal_entry",
        label: "A quiet planning milestone",
        occurredAt: "2026-08-04T12:00:00.000Z",
        source: "auto",
      }),
    ];

    assert.equal(isMeaningfulHappeningItem(fixtures[0]!), true);
    assert.equal(isMeaningfulHappeningItem(fixtures[1]!), true);
    assert.equal(isMeaningfulHappeningItem(fixtures[2]!), false); // every task completion
    assert.equal(isMeaningfulHappeningItem(fixtures[3]!), true);
    assert.equal(isMeaningfulHappeningItem(fixtures[4]!), false); // low-value automated

    const { visible, totalMeaningful } = selectWhatsHappeningForHome(fixtures, 5, NOW);
    assert.equal(totalMeaningful, 3);
    assert.equal(visible.length, 3);
    assert.ok(visible.every((v) => v.type !== "todo_completed"));
    assert.ok(visible.every((v) => !(v.type === "journal_entry" && fixtures.find((f) => f.occurredAt === v.occurredAt)?.source === "auto")));
  });

  it("caps at 5 and does not invent a view-all destination", () => {
    const many: ActivityItem[] = Array.from({ length: 8 }, (_, i) =>
      item({
        type: i % 2 === 0 ? "guest_added" : "photo_uploaded",
        label: i % 2 === 0 ? `Added ${i + 1} guests to your list` : "Saved Decor inspiration",
        occurredAt: new Date(Date.parse("2026-08-08T14:00:00.000Z") - i * 3_600_000).toISOString(),
      }),
    );

    const result = selectWhatsHappeningForHome(many, WHATS_HAPPENING_HOME_CAP, NOW);
    assert.equal(result.visible.length, 5);
    assert.equal(result.hasMore, true);
    assert.equal(WHATS_HAPPENING_VIEW_ALL_DESTINATION, null);
    assert.equal(result.showViewAll, false);
  });

  it("prioritizes shared (guests) before couple photos/journal", () => {
    const mixed: ActivityItem[] = [
      item({ type: "photo_uploaded", label: "Saved Florals inspiration", occurredAt: "2026-08-08T14:00:00.000Z" }),
      item({ type: "guest_added", label: "Added 1 guest to your list", occurredAt: "2026-08-07T10:00:00.000Z" }),
      item({
        type: "journal_entry",
        label: 'Wrote about "Menus"',
        occurredAt: "2026-08-08T13:00:00.000Z",
        source: "manual",
      }),
    ];

    const { visible } = selectWhatsHappeningForHome(mixed, 5, NOW);
    assert.equal(visible[0]!.type, "guest_added");
    assert.ok(visible.slice(1).every((v) => v.type === "photo_uploaded" || v.type === "journal_entry"));
  });

  it("does not title-dedupe distinct events with similar labels", () => {
    const dupish: ActivityItem[] = [
      item({ type: "photo_uploaded", label: "Saved Florals inspiration", occurredAt: "2026-08-08T14:00:00.000Z" }),
      item({ type: "photo_uploaded", label: "Saved Florals inspiration", occurredAt: "2026-08-07T14:00:00.000Z" }),
    ];
    const { visible, totalMeaningful } = selectWhatsHappeningForHome(dupish, 5, NOW);
    assert.equal(totalMeaningful, 2);
    assert.equal(visible.length, 2);
  });

  it("uses warm summaries and reliable destinations only", () => {
    assert.equal(
      formatHappeningSummary(item({ type: "guest_added", label: "Added 3 guests to your list", occurredAt: "2026-08-08T12:00:00.000Z" })),
      "You added 3 guests to your list",
    );
    assert.equal(
      formatHappeningSummary(item({ type: "photo_uploaded", label: "Captured a memory", occurredAt: "2026-08-08T12:00:00.000Z" })),
      "You captured a memory",
    );
    assert.equal(happeningDestination("guest_added"), "guests");
    assert.equal(happeningDestination("photo_uploaded"), "story");
    assert.equal(happeningDestination("journal_entry"), "story");
    assert.equal(happeningDestination("unknown_thing"), null);
  });

  it("formats calm relative times", () => {
    assert.equal(formatHappeningWhen("2026-08-08T14:59:00.000Z", NOW), "Just now");
    assert.equal(formatHappeningWhen("2026-08-08T13:00:00.000Z", NOW), "2 hours ago");
    assert.equal(formatHappeningWhen("2026-08-07T15:00:00.000Z", NOW), "Yesterday");
  });

  it("empty meaningful list stays empty (fixture for quiet week)", () => {
    const onlyNoise: ActivityItem[] = [
      item({ type: "todo_completed", label: 'Checked off "Call florist"', occurredAt: "2026-08-08T12:00:00.000Z" }),
      item({
        type: "journal_entry",
        label: "Auto milestone",
        occurredAt: "2026-08-08T11:00:00.000Z",
        source: "auto",
      }),
    ];
    const result = selectWhatsHappeningForHome(onlyNoise, 5, NOW);
    assert.equal(result.visible.length, 0);
    assert.equal(result.totalMeaningful, 0);
    assert.equal(result.hasMore, false);
  });

  it("handles null/undefined source payloads (error/loading) without inventing events", () => {
    assert.deepEqual(selectWhatsHappeningForHome(null, 5, NOW).visible, []);
    assert.deepEqual(selectWhatsHappeningForHome(undefined, 5, NOW).visible, []);
  });

  // Fixture coverage notes for WP cases where types are absent from SoT:
  // 1 venue / 2 vendor / 4 payment / 5 website — not emitted by get_recent_activity today.
  // Ranking helpers still prefer venue → vendor → shared → couple when those types appear.
  it("would rank hypothetical venue/vendor above couple without inventing them into the feed", () => {
    const mixed: ActivityItem[] = [
      item({ type: "photo_uploaded", label: "Saved Cake inspiration", occurredAt: "2026-08-08T14:00:00.000Z" }),
      item({ type: "venue_message", label: "Your venue sent you a message", occurredAt: "2026-08-07T14:00:00.000Z" }),
      item({ type: "vendor_upload", label: "Golden Hour Photography uploaded their insurance", occurredAt: "2026-08-06T14:00:00.000Z" }),
      item({ type: "payment_recorded", label: "A payment was recorded", occurredAt: "2026-08-05T14:00:00.000Z" }),
      item({ type: "website_published", label: "Your wedding website was published", occurredAt: "2026-08-04T14:00:00.000Z" }),
    ];
    const { visible } = selectWhatsHappeningForHome(mixed, 5, NOW);
    assert.deepEqual(
      visible.map((v) => v.type),
      ["venue_message", "vendor_upload", "payment_recorded", "website_published", "photo_uploaded"],
    );
    assert.equal(happeningDestination("venue_message"), "messages");
    assert.equal(happeningDestination("payment_recorded"), "payments");
    assert.equal(happeningDestination("website_published"), "website");
  });
});
