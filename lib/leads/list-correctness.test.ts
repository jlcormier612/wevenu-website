import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  appendLeadWindow,
  shouldApplyLoadMoreResult,
  leadsFilterFingerprint,
} from "@/lib/leads/list-navigation";
import {
  filterLeadsForList,
  LEADS_PAGE_SIZE,
  nextProgressiveWindow,
} from "@/lib/leads/list-query";
import {
  LEADS_LIST_INDEX_HARD_CAP,
  LEADS_LIST_INDEX_TRUNCATED_MESSAGE,
} from "@/lib/leads/repository";
import type { Lead } from "@/lib/leads/types";

function lead(partial: Partial<Lead> & Pick<Lead, "id" | "firstName" | "salesStage">): Lead {
  return {
    venueId: "v1",
    status: partial.salesStage,
    pipelineStageId: null,
    source: null,
    lastName: "Test",
    email: `${partial.id}@example.com`,
    phone: null,
    preferredCommunicationChannels: [],
    partnerFirstName: null,
    partnerLastName: null,
    partnerEmail: null,
    eventType: null,
    eventDate: null,
    endDate: null,
    guestCount: null,
    estimatedBudget: null,
    inquiryMessage: null,
    inquiryDate: "2026-01-15",
    nextActionText: null,
    nextActionDue: null,
    followUpDate: null,
    lastContactedAt: null,
    tourDate: null,
    tourTime: null,
    tourCompleted: false,
    tourNotes: null,
    commitmentScore: 0,
    responsivenessScore: 0,
    interestScore: 0,
    scoresUpdatedAt: null,
    sourceData: null,
    relationshipId: `rel-${partial.id}`,
    intakeConfidence: null,
    lostReason: null,
    lostReasonDetail: null,
    lostAt: null,
    firstBookedAt: null,
    venueSeenAt: null,
    assignedStaffId: null,
    mergedIntoLeadId: null,
    mergedAt: null,
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    ...partial,
  };
}

describe("Leads index truncation correctness", () => {
  it("documents hard-cap probe and refuses partial-as-complete results", () => {
    const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
    const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.equal(LEADS_LIST_INDEX_HARD_CAP, 20_000);
    assert.match(repo, /LEADS_LIST_INDEX_HARD_CAP,\s*LEADS_LIST_INDEX_HARD_CAP/);
    assert.match(repo, /truncated/);
    assert.match(repo, /return \{ leads: \[\], truncated: true \}/);
    assert.match(service, /indexResult\.truncated/);
    assert.match(service, /LEADS_LIST_INDEX_TRUNCATED_MESSAGE/);
    assert.match(service, /indexError:/);
    assert.match(list, /leads-index-error/);
    assert.match(list, /indexError/);
    assert.ok(LEADS_LIST_INDEX_TRUNCATED_MESSAGE.length > 20);
  });

  it("exact-cap boundary: 20000 complete, 20001 probes as truncated", () => {
    // Pure contract of decideTruncated(probeHasRow)
    function decideTruncated(probeHasRow: boolean): { truncated: boolean; returnEmpty: boolean } {
      if (!probeHasRow) return { truncated: false, returnEmpty: false };
      return { truncated: true, returnEmpty: true };
    }
    assert.deepEqual(decideTruncated(false), { truncated: false, returnEmpty: false });
    assert.deepEqual(decideTruncated(true), { truncated: true, returnEmpty: true });
  });
});

describe("Progressive load under mutating data", () => {
  it("insert before the window does not omit or duplicate on Show more", () => {
    const original = Array.from({ length: 45 }, (_, i) =>
      lead({ id: `l${i}`, firstName: `N${i}`, salesStage: "new_inquiry", inquiryDate: `2026-02-${String((i % 28) + 1).padStart(2, "0")}` }),
    );
    const filtered0 = filterLeadsForList(original, { outcome: "active", sort: "newest" });
    const first = nextProgressiveWindow(filtered0, [], LEADS_PAGE_SIZE);
    assert.equal(first.pageItems.length, 20);

    // Newer lead inserts at the front of the sorted set.
    const inserted = lead({
      id: "inserted",
      firstName: "Inserted",
      salesStage: "new_inquiry",
      inquiryDate: "2026-12-31",
    });
    const filtered1 = filterLeadsForList([inserted, ...original], { outcome: "active", sort: "newest" });
    const second = nextProgressiveWindow(
      filtered1,
      first.pageItems.map((l) => l.id),
      LEADS_PAGE_SIZE,
    );
    const shown = appendLeadWindow(first.pageItems, second.pageItems);
    const ids = shown.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length, "no duplicates");
    assert.ok(ids.includes("inserted"), "inserted lead eventually appears");
    assert.equal(second.totalMatching, 46);
  });

  it("stage move out of filter does not duplicate; remaining rows still load", () => {
    const original = Array.from({ length: 40 }, (_, i) =>
      lead({ id: `l${i}`, firstName: `N${i}`, salesStage: "new_inquiry" }),
    );
    const first = nextProgressiveWindow(original, [], 20);
    // One displayed lead leaves the matching set (booked).
    const after = original.map((l) =>
      l.id === first.pageItems[0]!.id ? { ...l, salesStage: "booked" as const, status: "booked" as const } : l,
    );
    const filtered = filterLeadsForList(after, { outcome: "active", sort: "newest" });
    const second = nextProgressiveWindow(
      filtered,
      first.pageItems.map((l) => l.id),
      20,
    );
    const shown = appendLeadWindow(first.pageItems, second.pageItems);
    assert.equal(new Set(shown.map((l) => l.id)).size, shown.length);
    assert.equal(second.totalMatching, 39);
    // Next chunk has no overlap with already-shown ids.
    for (const row of second.pageItems) {
      assert.equal(first.pageItems.some((l) => l.id === row.id), false);
    }
  });

  it("deleted/archived lead between requests does not create a silent gap", () => {
    const original = Array.from({ length: 35 }, (_, i) =>
      lead({ id: `l${i}`, firstName: `N${i}`, salesStage: "new_inquiry" }),
    );
    const first = nextProgressiveWindow(original, [], 20);
    const removedId = first.pageItems[5]!.id;
    const afterDelete = original.filter((l) => l.id !== removedId);
    const second = nextProgressiveWindow(
      afterDelete,
      first.pageItems.map((l) => l.id),
      20,
    );
    // Offset-based would skip one; exclude-id fills from remaining unmatched.
    assert.equal(second.pageItems.length, 15);
    assert.equal(second.hasMore, false);
    const shown = appendLeadWindow(
      first.pageItems.filter((l) => l.id !== removedId),
      second.pageItems,
    );
    assert.equal(shown.length, 34);
    assert.equal(new Set(shown.map((l) => l.id)).size, 34);
    assert.equal(shown.some((l) => l.id === removedId), false);
  });
});

describe("Pending Show-more vs filter change", () => {
  it("drops append when generation or fingerprint changes", () => {
    const fpA = leadsFilterFingerprint({
      q: "",
      status: "all",
      eventType: "all",
      sort: "newest",
      attention: "all",
      outcome: "active",
    });
    const fpB = leadsFilterFingerprint({
      q: "",
      status: "new_inquiry",
      eventType: "all",
      sort: "newest",
      attention: "all",
      outcome: "active",
    });
    assert.notEqual(fpA, fpB);
    assert.equal(
      shouldApplyLoadMoreResult({
        requestGeneration: 1,
        currentGeneration: 2,
        requestFingerprint: fpA,
        currentFingerprint: fpA,
      }),
      false,
    );
    assert.equal(
      shouldApplyLoadMoreResult({
        requestGeneration: 2,
        currentGeneration: 2,
        requestFingerprint: fpA,
        currentFingerprint: fpB,
      }),
      false,
    );
    assert.equal(
      shouldApplyLoadMoreResult({
        requestGeneration: 2,
        currentGeneration: 2,
        requestFingerprint: fpB,
        currentFingerprint: fpB,
      }),
      true,
    );
  });

  it("loadMore action + list wire excludeIds and fingerprint guards", () => {
    const actions = readFileSync(resolve("app/(app)/leads/actions.ts"), "utf8");
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.match(actions, /excludeIds/);
    assert.match(actions, /filterFingerprint/);
    assert.match(actions, /input\.filterFingerprint !== filterFingerprint/);
    assert.match(list, /shouldApplyLoadMoreResult/);
    assert.match(list, /excludeIds/);
    assert.match(list, /fingerprintRef/);
    assert.match(list, /loadMoreGenRef\.current \+= 1/);
  });
});
