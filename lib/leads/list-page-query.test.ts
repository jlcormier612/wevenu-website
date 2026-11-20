import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  buildEventTypeCounts,
  buildStatusCounts,
  filterLeadsForList,
  nextProgressiveWindow,
  sliceLeadWindow,
  type LeadsListSort,
} from "@/lib/leads/list-query";
import {
  LEADS_LIST_COUNTS_RPC,
  LEADS_LIST_PAGE_COUNT_STAGES,
  LEADS_LIST_PAGE_RPC,
  LEADS_LIST_ROWS_RPC,
  leadMatchesListPage,
  resolvedListSalesStage,
  selectLeadsListPage,
} from "@/lib/leads/list-page-query";
import type { Lead } from "@/lib/leads/types";

const NOW = Date.parse("2026-11-20T15:00:00.000Z");
const DAY = 86_400_000;

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
    lastContactedAt: new Date(NOW - DAY).toISOString(),
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
    venueSeenAt: "2026-01-16T00:00:00.000Z",
    assignedStaffId: null,
    mergedIntoLeadId: null,
    mergedAt: null,
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    ...partial,
  };
}

function indexOrder(leads: readonly Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const ai = a.inquiryDate ?? "";
    const bi = b.inquiryDate ?? "";
    if (ai !== bi) return ai < bi ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    if (a.id !== b.id) return a.id < b.id ? 1 : -1;
    return 0;
  });
}

function ids(leads: readonly Lead[]): string[] {
  return leads.map((row) => row.id);
}

const population = [
  lead({
    id: "new-a",
    firstName: "Ann",
    salesStage: "new_inquiry",
    inquiryDate: "2026-06-02",
    createdAt: "2026-06-02T01:00:00.000Z",
    eventType: "Wedding",
    eventDate: "2026-12-01",
    estimatedBudget: 1000,
    commitmentScore: 10,
    lastContactedAt: new Date(NOW - 8 * DAY).toISOString(),
    venueSeenAt: null,
    email: "ann@example.com",
  }),
  lead({
    id: "new-b",
    firstName: "ann",
    salesStage: "new_inquiry",
    inquiryDate: "2026-06-02",
    createdAt: "2026-06-02T03:00:00.000Z",
    eventType: "corporate_event",
    eventDate: "2026-11-01",
    estimatedBudget: null,
    commitmentScore: 40,
    lastContactedAt: new Date(NOW - DAY).toISOString(),
    venueSeenAt: null,
  }),
  lead({
    id: "new-c",
    firstName: "Bea",
    salesStage: "tour_scheduled",
    inquiryDate: "2026-05-01",
    createdAt: "2026-05-01T01:00:00.000Z",
    eventType: "birthday_milestone",
    eventDate: null,
    estimatedBudget: 0,
    commitmentScore: 10,
    lastContactedAt: null,
    venueSeenAt: null,
    phone: "555-0100",
  }),
  lead({
    id: "seen",
    firstName: "Cara",
    salesStage: "proposal_sent",
    inquiryDate: "2026-04-01",
    createdAt: "2026-04-01T01:00:00.000Z",
    eventType: "other",
    source: "website",
    lastContactedAt: new Date(NOW - DAY).toISOString(),
    venueSeenAt: "2026-04-02T00:00:00.000Z",
  }),
  lead({
    id: "sam-new",
    firstName: "Sam",
    salesStage: "outreach_sent",
    inquiryDate: "2026-01-20",
    createdAt: "2026-01-20T01:00:00.000Z",
    eventType: "social_event",
  }),
  lead({
    id: "sam-old",
    firstName: "Sam",
    salesStage: "outreach_sent",
    inquiryDate: "2026-01-10",
    createdAt: "2026-01-10T02:00:00.000Z",
    eventType: "social event",
  }),
  lead({
    id: "rehearsal",
    firstName: "Cy",
    salesStage: "enrolled_in_sequence",
    inquiryDate: null as unknown as string,
    createdAt: "2026-08-01T01:00:00.000Z",
    eventType: "rehearsal dinner",
    partnerEmail: "secret-partner@example.com",
    lastContactedAt: new Date(NOW - DAY).toISOString(),
    venueSeenAt: null,
  }),
  lead({
    id: "search-hit",
    firstName: "Zoe",
    salesStage: "enrolled_in_sequence",
    inquiryDate: "2026-02-15",
    createdAt: "2026-02-15T01:00:00.000Z",
    email: "unique-search@example.com",
    eventType: "Quinceañera",
  }),
  lead({
    id: "lost-1",
    firstName: "Dee",
    salesStage: "lost",
    inquiryDate: "2026-03-01",
    createdAt: "2026-03-01T01:00:00.000Z",
  }),
  lead({
    id: "booked-1",
    firstName: "Eve",
    salesStage: "booked",
    inquiryDate: "2026-07-01",
    createdAt: "2026-07-01T01:00:00.000Z",
  }),
  lead({
    id: "won-1",
    firstName: "Fay",
    salesStage: "won" as Lead["salesStage"],
    inquiryDate: "2026-07-02",
    createdAt: "2026-07-02T01:00:00.000Z",
  }),
  lead({
    id: "cancelled-1",
    firstName: "Gia",
    salesStage: "cancelled" as Lead["salesStage"],
    inquiryDate: "2026-01-01",
    createdAt: "2026-01-01T01:00:00.000Z",
  }),
];

const indexed = indexOrder(population);
const sorts: LeadsListSort[] = [
  "newest",
  "oldest",
  "az",
  "za",
  "event_asc",
  "event_desc",
  "budget_high",
  "budget_low",
  "last_contacted",
  "commitment_high",
];

describe("Phase 1A paged Leads query matches today's list semantics", () => {
  it("keeps the same ids and order for every list sort", () => {
    for (const sort of sorts) {
      const expected = ids(filterLeadsForList(indexed, { sort, outcome: "active" }));
      const actual = ids(selectLeadsListPage(population, { sort, outcome: "active", pageSize: 500 }).leads);
      assert.deepEqual(actual, expected, sort);
    }
  });

  it("does not change newest order when the input is shuffled", () => {
    const shuffled = [...population].reverse();
    assert.deepEqual(
      ids(selectLeadsListPage(shuffled, { sort: "newest", pageSize: 500 }).leads),
      ids(selectLeadsListPage(population, { sort: "newest", pageSize: 500 }).leads),
    );
  });

  it("matches stage, event type, search, and attention filters", () => {
    const cases: Array<Parameters<typeof filterLeadsForList>[1]> = [
      { outcome: "active", status: "tour_scheduled" },
      { outcome: "active", status: "outreach_sent" },
      { outcome: "lost" },
      { outcome: "active", eventType: "wedding" },
      { outcome: "active", eventType: "corporate" },
      { outcome: "active", eventType: "birthday" },
      { outcome: "active", eventType: "rehearsal_dinner" },
      { outcome: "active", eventType: "quinceanera" },
      { outcome: "active", eventType: "social_event" },
      { outcome: "active", q: "unique-search" },
      { outcome: "active", q: "555-0100" },
      { outcome: "active", q: "secret-partner" },
      { outcome: "active", q: "WEBSITE" },
      { outcome: "active", attention: "stale_contact" },
      { outcome: "active", attention: "unseen" },
      { outcome: "active", attention: "open" },
      { outcome: "lost", attention: "unseen" },
      { outcome: "lost", attention: "open" },
      {
        outcome: "active",
        attention: "unattended_inquiry",
        unattendedInquiryLeadIds: ["new-b", "search-hit", "booked-1"],
      },
    ];
    for (const params of cases) {
      const expected = ids(filterLeadsForList(indexed, params));
      const page = selectLeadsListPage(population, { ...params, pageSize: 500 }, NOW);
      assert.deepEqual(ids(page.leads), expected, JSON.stringify(params));
      assert.equal(page.totalMatching, expected.length);
    }
  });

  it("does not treat partner email as a search field", () => {
    assert.equal(
      leadMatchesListPage(population.find((row) => row.id === "rehearsal")!, {
        q: "secret-partner",
        outcome: "active",
      }, NOW),
      false,
    );
  });

  it("pages and show-more exclusions the same way as the live window", () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      lead({
        id: `p${String(i).padStart(2, "0")}`,
        firstName: `P${i}`,
        salesStage: "new_inquiry",
        inquiryDate: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
        createdAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    const ordered = indexOrder(many);
    const filtered = filterLeadsForList(ordered, { sort: "newest", outcome: "active" });
    const first = selectLeadsListPage(many, { sort: "newest", pageSize: 20 });
    const second = selectLeadsListPage(many, { sort: "newest", pageSize: 20, offset: 20 });
    assert.deepEqual(ids(first.leads), ids(sliceLeadWindow(filtered, 0, 20).pageItems));
    assert.deepEqual(ids(second.leads), ids(sliceLeadWindow(filtered, 20, 20).pageItems));
    assert.equal(first.hasMore, true);
    assert.equal(second.hasMore, true);
    const seen = new Set(ids(first.leads));
    for (const id of ids(second.leads)) assert.equal(seen.has(id), false);

    const excluded = ids(first.leads);
    const more = selectLeadsListPage(many, {
      sort: "newest",
      pageSize: 20,
      excludeIds: excluded,
      offset: 99,
    });
    const progressive = nextProgressiveWindow(filtered, excluded, 20);
    assert.deepEqual(ids(more.leads), ids(progressive.pageItems));
    assert.equal(more.offset, 0);
    assert.equal(more.totalMatching, filtered.length);
    assert.equal(more.hasMore, progressive.hasMore);
  });

  it("keeps full-index counts, including the caller-supplied booked chip", () => {
    const page = selectLeadsListPage(population, { currentBookedCount: 42, pageSize: 20 }, NOW);
    const counts = Object.fromEntries(buildStatusCounts(population, 42));
    assert.deepEqual(page.statusCounts, counts);
    assert.equal(page.statusCounts.booked, 42);
    assert.equal(page.statusCounts.lost, 1);
    assert.equal(page.statusCounts.all, population.length - 4);
    assert.deepEqual(page.eventTypeCounts, buildEventTypeCounts(population));
    assert.equal(page.totalLeads, population.length);
    for (const stage of LEADS_LIST_PAGE_COUNT_STAGES) {
      assert.equal(typeof page.statusCounts[stage], "number");
    }
  });
});

describe("resolved list stage matches the index mapper", () => {
  it("prefers a real sales stage and migrates legacy status without a tour", () => {
    assert.equal(resolvedListSalesStage("cancelled", "won"), "cancelled");
    assert.equal(resolvedListSalesStage("booked", "new"), "booked");
    assert.equal(resolvedListSalesStage("tour_scheduled", null), "tour_scheduled");
    assert.equal(resolvedListSalesStage(null, "qualified"), "outreach_sent");
    assert.equal(resolvedListSalesStage(null, "won"), "booked");
    assert.equal(resolvedListSalesStage(null, "cancelled"), "lost");
    assert.equal(resolvedListSalesStage(null, "new"), "new_inquiry");
    assert.equal(resolvedListSalesStage(null, "contacted"), "outreach_sent");
    assert.equal(resolvedListSalesStage(null, "proposal_sent"), "proposal_sent");
    assert.equal(resolvedListSalesStage("not-a-stage", "lost"), "lost");
    assert.equal(resolvedListSalesStage(null, null), "new_inquiry");
  });
});

describe("Phase 1 — live list stays on Wave 1 after browser remasure rollback", () => {
  it("keeps hot-path RPCs off getLeadsListPage and splits rows from counts", () => {
    const combined = readFileSync(
      resolve("supabase/migrations/20270205120000_leads_list_page_query.sql"),
      "utf8",
    );
    const hot = readFileSync(
      resolve("supabase/migrations/20270206120000_leads_list_hot_path.sql"),
      "utf8",
    );
    const service = readFileSync(resolve("lib/leads/service.ts"), "utf8");
    const repo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
    const pageStart = service.indexOf("export async function getLeadsListPage");
    const pageEnd = service.indexOf("export function leadIdentityKey");
    const livePage = service.slice(pageStart, pageEnd);

    assert.equal(LEADS_LIST_PAGE_RPC, "query_leads_list_page");
    assert.equal(LEADS_LIST_ROWS_RPC, "query_leads_list_rows");
    assert.equal(LEADS_LIST_COUNTS_RPC, "query_leads_list_counts");
    assert.match(combined, /function public\.query_leads_list_page/);
    assert.match(hot, /function public\.query_leads_list_rows/);
    assert.match(hot, /function public\.query_leads_list_counts/);
    assert.match(hot, /Not wired to live UI until dual gates pass/);
    assert.match(repo, /export async function queryLeadsListPage/);
    assert.match(repo, /export async function queryLeadsListPageHotPath/);
    assert.match(repo, /LEADS_LIST_ROWS_RPC/);
    assert.match(repo, /LEADS_LIST_COUNTS_RPC/);
    assert.match(livePage, /getLeadsListIndex/);
    assert.doesNotMatch(
      livePage,
      /queryLeadsListPage|queryLeadsListPageHotPath|query_leads_list_/,
    );
  });
});
