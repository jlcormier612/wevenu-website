import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  leadBelongsInFocusPopulation,
  leadMatchesFocusFollowUpRules,
  leadMatchesFocusTourRules,
} from "@/lib/dashboard/focus-lead-membership";

const TODAY = "2026-10-01";
const TWO_DAYS_AGO_MS = Date.parse("2026-09-28T12:00:00.000Z");
const TWO_WEEKS_OUT = "2026-10-15";

function lead(overrides: Partial<{
  salesStage: string;
  followUpDate: string | null;
  createdAt: string;
  tourDate: string | null;
  tourCompleted: boolean;
}> = {}) {
  return {
    salesStage: "new_inquiry",
    followUpDate: null as string | null,
    createdAt: "2026-09-20T12:00:00.000Z",
    tourDate: null as string | null,
    tourCompleted: false,
    ...overrides,
  };
}

describe("Focus lead membership (locked rules)", () => {
  it("includes overdue follow-up on open lifecycle", () => {
    assert.equal(
      leadMatchesFocusFollowUpRules(
        lead({ salesStage: "tour_scheduled", followUpDate: "2026-09-30" }),
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      true,
    );
  });

  it("includes follow-up due today on open lifecycle", () => {
    assert.equal(
      leadMatchesFocusFollowUpRules(
        lead({ salesStage: "outreach_sent", followUpDate: TODAY }),
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      true,
    );
  });

  it("includes stale new_inquiry (>48h, no follow-up)", () => {
    assert.equal(
      leadMatchesFocusFollowUpRules(
        lead({ salesStage: "new_inquiry", followUpDate: null, createdAt: "2026-09-20T12:00:00.000Z" }),
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      true,
    );
  });

  it("excludes fresh new_inquiry within 48h with no follow-up", () => {
    assert.equal(
      leadMatchesFocusFollowUpRules(
        lead({
          salesStage: "new_inquiry",
          followUpDate: null,
          createdAt: "2026-09-30T20:00:00.000Z",
        }),
        TODAY,
        TWO_DAYS_AGO_MS,
      ),
      false,
    );
  });

  it("excludes terminal leads even with overdue follow-up", () => {
    for (const salesStage of ["booked", "lost", "won", "cancelled"]) {
      assert.equal(
        leadMatchesFocusFollowUpRules(
          lead({ salesStage, followUpDate: "2026-09-01" }),
          TODAY,
          TWO_DAYS_AGO_MS,
        ),
        false,
        salesStage,
      );
    }
  });

  it("includes tour today and tour +10d when not completed", () => {
    assert.equal(
      leadMatchesFocusTourRules({ tourDate: TODAY, tourCompleted: false }, TODAY, TWO_WEEKS_OUT),
      true,
    );
    assert.equal(
      leadMatchesFocusTourRules({ tourDate: "2026-10-11", tourCompleted: false }, TODAY, TWO_WEEKS_OUT),
      true,
    );
  });

  it("excludes completed tours and tours beyond +14d", () => {
    assert.equal(
      leadMatchesFocusTourRules({ tourDate: TODAY, tourCompleted: true }, TODAY, TWO_WEEKS_OUT),
      false,
    );
    assert.equal(
      leadMatchesFocusTourRules({ tourDate: "2026-10-16", tourCompleted: false }, TODAY, TWO_WEEKS_OUT),
      false,
    );
  });

  it("union: lead matching both overdue and tour still belongs once", () => {
    const l = lead({
      salesStage: "tour_scheduled",
      followUpDate: "2026-09-28",
      tourDate: "2026-10-11",
      tourCompleted: false,
    });
    assert.equal(leadBelongsInFocusPopulation(l, TODAY, TWO_DAYS_AGO_MS, TWO_WEEKS_OUT), true);
  });

  it("tour-only open lead belongs; terminal tour lead does not via follow-up rules", () => {
    assert.equal(
      leadBelongsInFocusPopulation(
        lead({
          salesStage: "proposal_sent",
          followUpDate: null,
          createdAt: "2026-09-30T20:00:00.000Z",
          tourDate: "2026-10-05",
          tourCompleted: false,
        }),
        TODAY,
        TWO_DAYS_AGO_MS,
        TWO_WEEKS_OUT,
      ),
      true,
    );
    assert.equal(
      leadBelongsInFocusPopulation(
        lead({
          salesStage: "booked",
          followUpDate: "2026-09-01",
          tourDate: "2026-10-05",
          tourCompleted: false,
        }),
        TODAY,
        TWO_DAYS_AGO_MS,
        TWO_WEEKS_OUT,
      ),
      false,
    );
  });
});

describe("Dashboard Phase 3A critical path contracts", () => {
  const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
  const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");

  it("Dashboard service uses read-only recommendations", () => {
    assert.match(service, /readVenueRecommendations/);
    assert.doesNotMatch(service, /getVenueRecommendations\(/);
    assert.doesNotMatch(service, /refreshVenueRecommendations\(/);
    assert.doesNotMatch(service, /generate_venue_recommendations/);
    assert.doesNotMatch(service, /syncClientAskGapRecommendations/);
    assert.doesNotMatch(service, /syncTourFollowupPatternRecommendation/);
    assert.doesNotMatch(service, /syncPhase5SpotPatternRecommendations/);
  });

  it("Dashboard service does not run unused engines or write-on-read manufactures", () => {
    assert.doesNotMatch(service, /getVenueTrends/);
    assert.doesNotMatch(service, /getVenueMemories/);
    assert.doesNotMatch(service, /getVenueHealthScore/);
    assert.doesNotMatch(service, /getLuvActionObservations/);
    assert.doesNotMatch(service, /getPendingLuvActions/);
    assert.doesNotMatch(service, /getLuvPerformanceObservations/);
    assert.doesNotMatch(service, /compute_action_outcomes/);
    assert.doesNotMatch(service, /refreshAllLeadScores/);
    assert.doesNotMatch(service, /getDailyBriefing\(/);
    assert.match(service, /getFocusNeedsAttentionBriefing/);
    assert.match(service, /loadFocusPopulationLeads/);
  });

  it("Dashboard page still renders Focus, Coming Up, Snapshot, and L1", () => {
    assert.match(page, /Today's Focus/);
    assert.match(page, /Coming up/);
    assert.match(page, /BusinessSnapshotSection/);
    assert.match(page, /selectLuvDashboardEntry/);
    assert.match(page, /DashboardLuvEntryCard/);
  });

  it("Spot Patterns keep an explicit refresh path", () => {
    const spot = readFileSync(resolve("components/luv/spot-pattern-recommendations.tsx"), "utf8");
    assert.match(spot, /refreshVenueRecommendations/);
    assert.doesNotMatch(spot, /readVenueRecommendations/);
  });
});
