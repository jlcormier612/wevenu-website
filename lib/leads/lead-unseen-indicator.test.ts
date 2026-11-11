/**
 * Row-level New / pink-dot indicator — same eligibility as Leads nav badge.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  LeadUnseenIndicator,
  leadShowsUnseenIndicator,
} from "@/components/leads/lead-unseen-indicator";
import {
  countUnseenLeads,
  isUnseenLeadAttention,
} from "@/lib/navigation/attention";

const listSrc = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
const indicatorSrc = readFileSync(
  resolve("components/leads/lead-unseen-indicator.tsx"),
  "utf8",
);
const detailPageSrc = readFileSync(
  resolve("app/(app)/leads/[id]/page.tsx"),
  "utf8",
);
const attentionServiceSrc = readFileSync(
  resolve("lib/navigation/attention-service.ts"),
  "utf8",
);
const sidebarSrc = readFileSync(
  resolve("components/shell/sidebar-nav.tsx"),
  "utf8",
);

describe("lead unseen row indicator eligibility", () => {
  it("shows for unseen non-terminal leads (same as badge)", () => {
    assert.equal(
      leadShowsUnseenIndicator({ venueSeenAt: null, salesStage: "new_inquiry" }),
      true,
    );
    assert.equal(
      leadShowsUnseenIndicator({ venueSeenAt: null, salesStage: "tour_scheduled" }),
      true,
    );
    assert.equal(
      leadShowsUnseenIndicator({ venueSeenAt: null, salesStage: "proposal_sent" }),
      true,
    );
    assert.equal(
      isUnseenLeadAttention({ venueSeenAt: null, salesStage: "new_inquiry" }),
      leadShowsUnseenIndicator({ venueSeenAt: null, salesStage: "new_inquiry" }),
    );
  });

  it("hides when venue_seen_at is set — including New Inquiry stage", () => {
    assert.equal(
      leadShowsUnseenIndicator({
        venueSeenAt: "2026-10-01T12:00:00Z",
        salesStage: "new_inquiry",
      }),
      false,
    );
    assert.equal(
      isUnseenLeadAttention({
        venueSeenAt: "2026-10-01T12:00:00Z",
        salesStage: "new_inquiry",
      }),
      false,
    );
  });

  it("hides for terminal stages even when venue_seen_at is null", () => {
    for (const stage of ["booked", "lost", "won", "cancelled"] as const) {
      assert.equal(
        leadShowsUnseenIndicator({ venueSeenAt: null, salesStage: stage }),
        false,
        stage,
      );
    }
  });

  it("row indicator and sidebar badge count the same population", () => {
    const rows = [
      { venueSeenAt: null, salesStage: "new_inquiry" },
      { venueSeenAt: "2026-10-01T00:00:00Z", salesStage: "new_inquiry" },
      { venueSeenAt: null, salesStage: "tour_scheduled" },
      { venueSeenAt: null, salesStage: "booked" },
      { venueSeenAt: null, salesStage: "lost" },
      { venueSeenAt: "2026-09-01T00:00:00Z", salesStage: "proposal_sent" },
    ];
    const rowVisible = rows.filter(leadShowsUnseenIndicator).length;
    assert.equal(rowVisible, countUnseenLeads(rows));
    assert.equal(rowVisible, 2);
  });
});

describe("lead unseen row indicator presentation", () => {
  it("renders both pink dot and New label when qualifying", () => {
    assert.match(indicatorSrc, /bg-destructive/);
    assert.match(indicatorSrc, />\s*New\s*</);
    assert.match(indicatorSrc, /h-1\.5 w-1\.5/);
    assert.match(indicatorSrc, /data-testid="lead-unseen-indicator"/);
    assert.match(indicatorSrc, /isUnseenLeadAttention/);
    // Component returns null when not unseen — smoke the export.
    assert.equal(
      typeof LeadUnseenIndicator,
      "function",
    );
  });

  it("LeadList mounts the indicator beside the lead name", () => {
    assert.match(listSrc, /LeadUnseenIndicator/);
    assert.match(listSrc, /venueSeenAt=\{lead\.venueSeenAt\}/);
    const nameCell = listSrc.slice(
      listSrc.indexOf("<TableCell className=\"font-medium text-foreground\">"),
      listSrc.indexOf("<TableCell>", listSrc.indexOf("lead.eventType")),
    );
    assert.match(nameCell, /LeadUnseenIndicator/);
    assert.match(nameCell, /leadDisplayName/);
  });

  it("unseen attention filter uses the same eligibility helper as the badge", () => {
    assert.match(listSrc, /isUnseenLeadAttention/);
    const unseenGate = listSrc.indexOf('if (attentionFilter === "unseen")');
    assert.ok(unseenGate > 0);
    const unseenBlock = listSrc.slice(unseenGate, unseenGate + 280);
    assert.match(unseenBlock, /isUnseenLeadAttention/);
    assert.doesNotMatch(unseenBlock, /leadIsOpenOpportunity/);
  });
});

describe("venue-shared mark-seen lifecycle preserved", () => {
  it("lead detail still calls markLeadVenueSeen", () => {
    assert.match(detailPageSrc, /markLeadVenueSeen\(page\.lead\.id\)/);
  });

  it("markLeadVenueSeen only writes venue_seen_at and does not change sales_stage", () => {
    const fnStart = attentionServiceSrc.indexOf(
      "export async function markLeadVenueSeen",
    );
    const fnEnd = attentionServiceSrc.indexOf(
      "export async function markVenueToursSeen",
      fnStart,
    );
    const fn = attentionServiceSrc.slice(fnStart, fnEnd);
    assert.match(fn, /venue_seen_at/);
    assert.doesNotMatch(fn, /sales_stage/);
  });

  it("sidebar Leads badge path and unseen href are unchanged", () => {
    assert.match(sidebarSrc, /NAV_ATTENTION_BADGE_CLASS/);
    assert.match(sidebarSrc, /\/api\/navigation\/attention/);
    assert.match(listSrc, /attention=unseen|attentionFilter === "unseen"/);
  });
});
