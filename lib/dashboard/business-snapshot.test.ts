/**
 * Dashboard Business Snapshot — pure calculation + wiring tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

import {
  BUSINESS_SNAPSHOT_UPCOMING_DAYS,
  buildBusinessSnapshotCards,
  computeActivePipeline,
} from "@/lib/dashboard/business-snapshot";

const root = path.join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("computeActivePipeline", () => {
  it("counts only active opportunities and sums estimated budgets when present", () => {
    const result = computeActivePipeline([
      { sales_stage: "new_inquiry", estimated_budget: 10_000 },
      { sales_stage: "custom_whatever", estimated_budget: 5_000 },
      { sales_stage: "booked", estimated_budget: 99_000 },
      { sales_stage: "lost", estimated_budget: 1_000 },
      { sales_stage: "tour_scheduled", estimated_budget: null },
      { sales_stage: "proposal_sent", estimated_budget: 2_000, exclude_from_business_reporting: true },
    ]);
    assert.equal(result.count, 3);
    assert.equal(result.value, 15_000);
    assert.equal(result.budgetsPresent, 2);
  });

  it("does not hard-code Inquiry/Tour/Proposal stage names in venue-facing output", () => {
    const src = read("lib/dashboard/business-snapshot.ts");
    assert.match(src, /CLOSED_PIPELINE_STAGES/);
    // Venue-facing card builders must not emit fixed HTC stage labels.
    const cardBuilder = src.slice(src.indexOf("export function buildBusinessSnapshotCards"));
    assert.doesNotMatch(cardBuilder, /"Inquiry"|"Tour"|"Proposal"|"Decision"/);
  });
});

describe("buildBusinessSnapshotCards", () => {
  it("builds four equal-purpose cards with intentional empty states", () => {
    const empty = buildBusinessSnapshotCards({
      pipelineCount: 0,
      pipelineValue: 0,
      pipelineBudgetsPresent: 0,
      bookedCount: 0,
      bookedValue: 0,
      upcomingCount: 0,
      upcomingValue: 0,
      outstandingBalance: 0,
      outstandingClientCount: 0,
      upcomingWindowDays: BUSINESS_SNAPSHOT_UPCOMING_DAYS,
    });
    assert.equal(empty.length, 4);
    assert.deepEqual(empty.map((c) => c.key), ["pipeline", "booked", "upcoming", "outstanding"]);
    assert.ok(empty.every((c) => c.empty));
    assert.match(empty[0]!.primary, /No active opportunities/);
    assert.match(empty[1]!.primary, /No booked events/);
    assert.match(empty[2]!.primary, /No upcoming events/);
    assert.match(empty[3]!.primary, /Accounts current/);
  });

  it("links Pipeline to Leads, Upcoming to coming_up clients, Outstanding to payments", () => {
    const cards = buildBusinessSnapshotCards({
      pipelineCount: 2,
      pipelineValue: 8_000,
      pipelineBudgetsPresent: 1,
      bookedCount: 3,
      bookedValue: 40_000,
      upcomingCount: 1,
      upcomingValue: 12_000,
      outstandingBalance: 1_500,
      outstandingClientCount: 1,
      upcomingWindowDays: 60,
    });
    assert.equal(cards[0]!.href, "/leads");
    assert.equal(cards[1]!.href, "/clients");
    assert.equal(cards[2]!.href, "/clients?filter=coming_up");
    assert.equal(cards[3]!.href, "/payments");
    assert.equal(cards[0]!.empty, false);
    assert.match(cards[0]!.primary, /2 active leads/);
    assert.match(cards[3]!.primary, /\$1,500/);
  });

  it("uses the same 60-day Coming up horizon", () => {
    assert.equal(BUSINESS_SNAPSHOT_UPCOMING_DAYS, 60);
  });
});

describe("Dashboard Business Snapshot wiring", () => {
  it("renders Business Snapshot after Coming up and before View Reports", () => {
    const page = read("app/(app)/dashboard/page.tsx");
    assert.match(page, /BusinessSnapshotSection/);
    assert.match(page, /getBusinessSnapshot/);
    const comingIdx = page.indexOf('title="Coming up"');
    const snapIdx = page.indexOf("<BusinessSnapshotSection");
    const reportsIdx = page.indexOf(">View Reports<");
    assert.ok(comingIdx > 0, "Coming up section missing");
    assert.ok(snapIdx > comingIdx, "Business Snapshot must follow Coming up");
    assert.ok(reportsIdx > snapIdx, "View Reports must follow Business Snapshot");
    assert.doesNotMatch(page, /Your Next Steps/);
  });

  it("uses equal-height ComparisonCardGrid for snapshot cards", () => {
    const ui = read("components/dashboard/business-snapshot.tsx");
    assert.match(ui, /ComparisonCardGrid/);
    assert.match(ui, /min-h-\[8\.5rem\]/);
    assert.match(ui, /h-full/);
  });
});
