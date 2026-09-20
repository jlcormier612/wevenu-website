/**
 * Dashboard Business Snapshot — pure calculation + wiring tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

import {
  LEAD_FLOW_OPEN_HREF,
  buildBusinessSnapshotCards,
  computeOpenLeadFlow,
  isOpenLeadLifecycle,
} from "@/lib/dashboard/business-snapshot";
import { isOpenLeadOpportunity, isOpenReportingCategory } from "@/lib/leads/open-lifecycle";

const root = path.join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("computeOpenLeadFlow / open lifecycle", () => {
  it("counts all qualifying non-terminal leads including exclude_from_business_reporting", () => {
    const result = computeOpenLeadFlow(
      [
        { sales_stage: "new_inquiry", estimated_budget: 10_000, created_at: "2026-09-05T12:00:00Z" },
        { sales_stage: "custom_venue_stage", estimated_budget: 5_000, created_at: "2026-08-01T12:00:00Z" },
        { sales_stage: "booked", estimated_budget: 99_000, created_at: "2026-09-02T12:00:00Z" },
        { sales_stage: "lost", estimated_budget: 1_000, created_at: "2026-09-03T12:00:00Z" },
        { sales_stage: "won", estimated_budget: 2_000, created_at: "2026-09-04T12:00:00Z" },
        { sales_stage: "cancelled", estimated_budget: 3_000, created_at: "2026-09-05T12:00:00Z" },
        { sales_stage: "tour_scheduled", estimated_budget: null, created_at: "2026-09-10T12:00:00Z" },
        {
          sales_stage: "proposal_sent",
          estimated_budget: 2_000,
          created_at: "2026-09-11T12:00:00Z",
        },
      ],
      "2026-09-01",
    );
    // new_inquiry + custom + tour + proposal = 4; terminals excluded; no exclude-flag gate
    assert.equal(result.count, 4);
    assert.equal(result.value, 17_000);
    assert.equal(result.budgetsPresent, 3);
    assert.equal(result.newThisMonth, 3);
  });

  it("excludes booked sales_stage even when the venue reporting category is still open", () => {
    const result = computeOpenLeadFlow(
      [
        // sales_stage booked has left the funnel even if the venue stage is still proposal
        {
          sales_stage: "booked",
          canonical_stage: "proposal",
          estimated_budget: 4_000,
          created_at: "2026-09-12T12:00:00Z",
        },
        // reporting category booked → terminal even if sales_stage looks open
        {
          sales_stage: "new_inquiry",
          canonical_stage: "booked",
          estimated_budget: 9_000,
          created_at: "2026-09-12T12:00:00Z",
        },
        {
          sales_stage: "enrolled_in_sequence",
          canonical_stage: "decision",
          estimated_budget: 1_000,
          created_at: "2026-09-12T12:00:00Z",
        },
        {
          sales_stage: "lost",
          canonical_stage: "lost",
          estimated_budget: 500,
          created_at: "2026-09-12T12:00:00Z",
        },
        {
          sales_stage: "tour_scheduled",
          canonical_stage: "cancelled",
          estimated_budget: 800,
          created_at: "2026-09-12T12:00:00Z",
        },
      ],
      "2026-09-01",
    );
    assert.equal(result.count, 1);
    assert.equal(result.value, 1_000);
  });

  it("treats custom pipeline stage slugs as open when not terminal", () => {
    assert.equal(isOpenLeadLifecycle("New Inquiry"), true);
    assert.equal(isOpenLeadLifecycle("consultation_quote"), true);
    assert.equal(isOpenLeadLifecycle("booked"), false);
    assert.equal(isOpenLeadLifecycle("BOOKED"), false);
    assert.equal(isOpenLeadLifecycle("lost"), false);
    assert.equal(isOpenReportingCategory("inquiry"), true);
    assert.equal(isOpenReportingCategory("decision"), true);
    assert.equal(isOpenReportingCategory("booked"), false);
    assert.equal(isOpenReportingCategory("lost"), false);
    assert.equal(isOpenReportingCategory("cancelled"), false);
    assert.equal(isOpenReportingCategory("unmapped"), true);
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "booked", canonicalStage: "tour" }),
      false,
    );
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "new_inquiry", canonicalStage: "booked" }),
      false,
    );
  });

  it("does not hard-code Inquiry/Tour/Proposal in venue-facing card builders", () => {
    const src = read("lib/dashboard/business-snapshot.ts");
    const cardBuilder = src.slice(src.indexOf("export function buildBusinessSnapshotCards"));
    assert.doesNotMatch(cardBuilder, /"Inquiry"|"Tour"|"Proposal"|"Decision"/);
    assert.doesNotMatch(cardBuilder, /active leads/i);
  });

  it("Lead Flow compute path does not gate on exclude_from_business_reporting or client_id", () => {
    const snap = read("lib/dashboard/business-snapshot.ts");
    const compute = snap.slice(
      snap.indexOf("export function computeOpenLeadFlow"),
      snap.indexOf("function formatUsd"),
    );
    assert.doesNotMatch(compute, /exclude_from_business_reporting/);
    assert.doesNotMatch(compute, /client_id/);
    assert.match(compute, /isOpenLeadOpportunity/);
  });
});

describe("buildBusinessSnapshotCards", () => {
  it("builds Lead Flow → Booked Business → Cash Collected → Outstanding with empty states", () => {
    const empty = buildBusinessSnapshotCards({
      openLeadCount: 0,
      openLeadValue: 0,
      openLeadBudgetsPresent: 0,
      openLeadsNewThisMonth: 0,
      bookedCount: 0,
      bookedValue: 0,
      cashCollected: 0,
      outstandingBalance: 0,
      outstandingClientCount: 0,
    });
    assert.equal(empty.length, 4);
    assert.deepEqual(empty.map((c) => c.key), [
      "lead_flow",
      "booked_business",
      "cash_collected",
      "outstanding",
    ]);
    assert.ok(empty.every((c) => c.empty));
    assert.match(empty[0]!.primary, /No open leads/);
    assert.match(empty[1]!.primary, /No booked business yet/);
    assert.match(empty[2]!.primary, /No payments collected yet/);
    assert.match(empty[3]!.primary, /Accounts current/);
    assert.match(empty[3]!.secondary, /Nothing left to collect on booked events/i);
    assert.match(empty[3]!.tertiary, /Booked totals minus what you've collected/i);
    assert.doesNotMatch(empty[3]!.secondary, /financially committed/i);
    assert.doesNotMatch(empty[3]!.tertiary, /Gross booked/i);
    assert.doesNotMatch(empty[0]!.secondary, /not booked, lost, or cancelled/i);
    assert.doesNotMatch(empty.map((c) => c.key).join(","), /upcoming/);
  });

  it("links each card to the matching population and labels cash as all-time", () => {
    const cards = buildBusinessSnapshotCards({
      openLeadCount: 12,
      openLeadValue: 86_500,
      openLeadBudgetsPresent: 4,
      openLeadsNewThisMonth: 3,
      bookedCount: 18,
      bookedValue: 142_500,
      cashCollected: 90_000,
      outstandingBalance: 18_400,
      outstandingClientCount: 6,
    });
    assert.equal(cards[0]!.href, LEAD_FLOW_OPEN_HREF);
    assert.equal(cards[1]!.href, "/clients?filter=booked_business");
    assert.equal(cards[2]!.href, "/payments");
    assert.equal(cards[3]!.href, "/payments");
    assert.match(cards[0]!.primary, /12 open leads/);
    assert.match(cards[0]!.secondary, /\$86,500/);
    assert.match(cards[0]!.tertiary, /3 new this month/);
    assert.match(cards[1]!.primary, /18 booked events/);
    assert.match(cards[1]!.secondary, /\$142,500 contracted/);
    assert.match(cards[2]!.primary, /\$90,000/);
    assert.match(cards[2]!.secondary, /All-time collected/);
    assert.match(cards[3]!.primary, /\$18,400/);
    assert.match(cards[3]!.secondary, /6 client accounts/);
    assert.equal(cards[0]!.actionLabel, "View open leads");
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

  it("UI has equal-height cards, no Upcoming snapshot card, and open-leads destination", () => {
    const ui = read("components/dashboard/business-snapshot.tsx");
    const snap = read("lib/dashboard/business-snapshot.ts");
    assert.match(ui, /ComparisonCardGrid/);
    assert.match(ui, /min-h-\[11\.5rem\]/);
    assert.match(ui, /h-full/);
    assert.match(ui, /coming in, booked, collected, and still owed/);
    assert.doesNotMatch(ui, /upcoming events/i);
    assert.doesNotMatch(snap, /key: "upcoming"/);
    assert.match(snap, /getPaymentsCollected/);
    assert.match(snap, /getCanonicallyBookedClientIds/);
    assert.doesNotMatch(snap, /getCanonicalBookings/);
    assert.match(snap, /getOutstandingBalance/);
    assert.match(snap, /LEAD_FLOW_OPEN_HREF/);
  });

  it("Leads page honors attention=open with the same terminal lifecycle set", () => {
    const leadsPage = read("app/(app)/leads/page.tsx");
    const list = read("components/leads/lead-list.tsx");
    assert.match(leadsPage, /attention === "open"/);
    assert.match(list, /attentionFilter === "open"/);
    assert.match(list, /leadIsOpenOpportunity/);
    assert.match(list, /isOpenLeadOpportunity/);
    assert.match(list, /from "@\/lib\/leads\/open-lifecycle"/);
    // Open filter must not gate on reporting-exclusion (protected Sandbox personas stay open).
    const openBlock = list.slice(
      list.indexOf('if (attentionFilter === "open")'),
      list.indexOf('if (attentionFilter === "unseen")'),
    );
    assert.doesNotMatch(openBlock, /excludeFromBusinessReporting/);
  });
});
