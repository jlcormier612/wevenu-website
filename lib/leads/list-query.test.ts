import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  buildStatusCounts,
  filterLeadsForList,
  LEADS_PAGE_SIZE,
  paginateLeads,
  sortLeadsForList,
} from "@/lib/leads/list-query";
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

describe("Leads list-query pagination + counts", () => {
  const population = Array.from({ length: 120 }, (_, i) =>
    lead({
      id: `l${i}`,
      firstName: i % 2 === 0 ? `Alice${i}` : `Bob${i}`,
      salesStage: i < 100 ? "new_inquiry" : i < 110 ? "lost" : "booked",
      inquiryDate: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      email: i === 7 ? "unique-search@example.com" : `l${i}@example.com`,
    }),
  );

  it("paginates without dropping or duplicating ids across pages", () => {
    const filtered = filterLeadsForList(population, { outcome: "active", sort: "newest" });
    assert.equal(filtered.length, 100);
    const seen = new Set<string>();
    const totalPages = Math.ceil(filtered.length / LEADS_PAGE_SIZE);
    for (let page = 1; page <= totalPages; page++) {
      const { pageItems } = paginateLeads(filtered, page, LEADS_PAGE_SIZE);
      for (const row of pageItems) {
        assert.equal(seen.has(row.id), false, `duplicate ${row.id}`);
        seen.add(row.id);
      }
    }
    assert.equal(seen.size, filtered.length);
  });

  it("search matches across the full eligible set, not only page 1", () => {
    const filtered = filterLeadsForList(population, { q: "unique-search", outcome: "active" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "l7");
    const page = paginateLeads(filtered, 1, LEADS_PAGE_SIZE);
    assert.equal(page.totalMatching, 1);
    assert.equal(page.pageItems[0]?.id, "l7");
  });

  it("status counts cover the full index including lost + booked membership", () => {
    const counts = buildStatusCounts(population, 42);
    assert.equal(counts.get("all"), 100);
    assert.equal(counts.get("lost"), 10);
    assert.equal(counts.get("booked"), 42);
    assert.equal(counts.get("new_inquiry"), 100);
  });

  it("sort newest keeps inquiryDate descending", () => {
    const sorted = sortLeadsForList(population.slice(0, 5), "newest");
    for (let i = 1; i < sorted.length; i++) {
      assert.ok((sorted[i - 1]!.inquiryDate ?? "") >= (sorted[i]!.inquiryDate ?? ""));
    }
  });
});

describe("NAV-PERF Leads list architecture", () => {
  it("uses lean list index + server page window; defers spot patterns; no full-route loading.tsx", () => {
    const page = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    const island = readFileSync(resolve("components/leads/leads-list-island.tsx"), "utf8");
    const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
    const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");

    assert.match(page, /LeadsListIsland/);
    assert.match(page, /Suspense/);
    assert.match(page, /LeadsSpotIsland|SpotPatternRecommendationsPanel/);
    assert.doesNotMatch(page, /getLeads\(\)/);
    assert.match(island, /getLeadsListPage/);
    assert.match(island, /loadLeadMessageAttentionMap/);
    assert.match(island, /listPage\.leads\.map/);
    assert.match(service, /getLeadsListIndex/);
    assert.match(repo, /export async function getLeadsListIndex/);
    assert.match(repo, /LEAD_LIST_SELECT/);
    assert.match(repo, /EMPTY_TOUR/);
    assert.doesNotMatch(
      repo.slice(
        repo.indexOf("export async function getLeadsListIndex"),
        repo.indexOf("export async function getLeads("),
      ),
      /getCurrentToursForLeads/,
    );

    let loadingExists = true;
    try {
      readFileSync(resolve("app/(app)/leads/loading.tsx"), "utf8");
    } catch {
      loadingExists = false;
    }
    assert.equal(loadingExists, false, "leads/loading.tsx must be removed to avoid full-route skeleton flicker");
  });
});
